/**
 * ciclo.ts — um ciclo do worker: sessões abertas → leitura incremental → retratos → ingest → cursor.
 *
 * RN-11: lê só fichas das sessões abertas (paciente + unidade) desde o cursor; nunca a base inteira.
 * RN-12: retrato completo só quando cabeçalho e itens vieram; cursor avança após commit (2xx).
 * RN-13: estrutura diferente do mapeamento → leitura para com ERRO_ESTRUTURA.
 * SPEC-1-003/C3: edição recente (janela de 30 min) é relida — hash muda → novo retrato;
 *                cancelamento (ID sumiu) gera retrato com sourceStatus 'cancelada'.
 */
import type { SqlClient } from './sql.js'
import { MAPEAMENTO, verificarEstrutura } from './sql.js'
import type { SessoesClient, SessaoAberta } from './sessoes.js'
import type { IngestClient } from './ingest.js'
import type { CursorStore, CursorState } from './cursor.js'
import { proximoCursor } from './cursor.js'
import { createHash } from 'node:crypto'
import { normalizarFicha, type LinhaFicha, type LinhaItem, type LinhaPaciente, type Envelope, type Retrato } from './adaptador.js'

export type CicloDeps = {
  sql: SqlClient
  sessoes: SessoesClient
  ingest: IngestClient
  cursor: CursorStore
  tenantRef: string
  agora?: () => Date
  /** Memória de IDs vistos recentes (id → timestamp) — para detectar sumiços (cancelamento físico). */
  memoria?: Map<number, number>
}

export type ResultadoCiclo = {
  sessoesAbertas: number
  fichasLidas: number
  retratosEnviados: number
  confirmados: string[]
  cursor: CursorState | null
  estadoFonte: 'atualizado' | 'aguardando' | 'indisponivel' | 'leitura_parada'
}

/** Janela de releitura de edições (minutos) — ficha editada dentro dela é relida. */
export const JANELA_EDICAO_MIN = 30

/** Formata data para o SQL Server (datetime, sem T/Z). */
const fmtSql = (d: Date): string => d.toISOString().slice(0, 19).replace('T', ' ')

/** Consulta parametrizada — os IDs vêm das sessões abertas, nunca concatenação. */
export async function lerFichas(
  cliente: SqlClient,
  idsPacientes: number[],
  unidades: string[],
  desdeFichaId: number,
  desdeDataEdicao: Date | null = null,
): Promise<{ fichas: LinhaFicha[]; itens: LinhaItem[]; pacientes: LinhaPaciente[] }> {
  if (idsPacientes.length === 0 || unidades.length === 0) {
    return { fichas: [], itens: [], pacientes: [] }
  }
  const ids = idsPacientes.join(',')
  const locais = unidades.map((u) => `'${u.replace(/'/g, "''")}'`).join(',')
  // C3: fichas novas (ID > cursor) OU editadas dentro da janela (DATA >= limite).
  const clausulaJanela =
    desdeDataEdicao && !Number.isNaN(desdeDataEdicao.getTime())
      ? ` AND (ID > ${desdeFichaId} OR DATA >= '${fmtSql(desdeDataEdicao)}')`
      : ` AND ID > ${desdeFichaId}`
  const fichas = await cliente.query<LinhaFicha>(
    `SELECT ${MAPEAMENTO.ficha.colunas.join(', ')}
     FROM ${MAPEAMENTO.ficha.tabela}
     WHERE PACIENTE IN (${ids}) AND LOCAL IN (${locais})${clausulaJanela}`,
  )
  const idsFichas = fichas.recordset.map((f) => f.ID)
  if (idsFichas.length === 0) return { fichas: [], itens: [], pacientes: [] }
  const listaFichas = idsFichas.join(',')
  const itens = await cliente.query<LinhaItem>(
    `SELECT ${MAPEAMENTO.itens.colunas.join(', ')}
     FROM ${MAPEAMENTO.itens.tabela}
     WHERE ${MAPEAMENTO.itens.fk} IN (${listaFichas})`,
  )
  const idsPac = [...new Set(fichas.recordset.map((f) => f.PACIENTE))].join(',')
  const pacientes = await cliente.query<LinhaPaciente>(
    `SELECT ${MAPEAMENTO.paciente.colunas.join(', ')}
     FROM ${MAPEAMENTO.paciente.tabela}
     WHERE ID IN (${idsPac})`,
  )
  return { fichas: fichas.recordset, itens: itens.recordset, pacientes: pacientes.recordset }
}

/** Filtra a leitura bruta: fichas novas (ID > cursor) OU editadas dentro da janela. */
export function lerJanela(
  bruto: { fichas: LinhaFicha[]; itens: LinhaItem[]; pacientes: LinhaPaciente[] },
  cursor: { ultimaFichaId: number } | null,
  agora: Date,
): { fichas: LinhaFicha[]; itens: LinhaItem[]; pacientes: LinhaPaciente[] } {
  const ultimaFichaId = cursor?.ultimaFichaId ?? 0
  const limiteEdicao = new Date(agora.getTime() - JANELA_EDICAO_MIN * 60_000)
  const fichas = bruto.fichas.filter((f) => {
    if (Number(f.ID) > ultimaFichaId) return true
    const data = new Date(String(f.DATA))
    return !Number.isNaN(data.getTime()) && data >= limiteEdicao
  })
  if (fichas.length === bruto.fichas.length) return bruto
  const ids = new Set(fichas.map((f) => Number(f.ID)))
  return {
    fichas,
    itens: bruto.itens.filter((it) => ids.has(Number(it.SOLICITACAO_ID))),
    pacientes: bruto.pacientes,
  }
}

/** Retrato de ficha cancelada (ID sumiu do banco — exclusão é física). */
export function retratoCancelado(fichaId: string, agora: Date = new Date()): Retrato {
  const base = {
    encounterExternalId: String(fichaId),
    patientExternalId: '',
    profile: 'particular' as const,
    sourceStatus: 'cancelada',
    items: [],
  }
  const conteudo = JSON.stringify(base)
  const hash = createHash('sha256').update(conteudo).digest('hex')
  return {
    ...base,
    completeness: 'complete',
    contentHash: hash,
    observedAt: agora.toISOString(),
  }
}

export async function rodarCiclo(deps: CicloDeps): Promise<ResultadoCiclo> {
  const agora = deps.agora ?? (() => new Date())
  const resultado: ResultadoCiclo = {
    sessoesAbertas: 0,
    fichasLidas: 0,
    retratosEnviados: 0,
    confirmados: [],
    cursor: null,
    estadoFonte: 'aguardando',
  }

  // 1) Estrutura primeiro (RN-13) — divergência para tudo com erro de estrutura.
  try {
    await verificarEstrutura(deps.sql)
  } catch (e) {
    resultado.estadoFonte = 'leitura_parada'
    throw e
  }

  // 2) Sessões abertas no Skip.
  const sessoes = await deps.sessoes.listarSessoesAbertas()
  resultado.sessoesAbertas = sessoes.length
  if (sessoes.length === 0) {
    resultado.estadoFonte = 'aguardando'
    return resultado // mantém cursor, lê nada
  }

  // 3) Cursor persistente.
  const estado = await deps.cursor.ler()

  // 4) Resolução CPF → PACIENTE.ID via SQL (a sessão abre pelo CPF, não pelo ID).
  const cpfs = [...new Set(sessoes.map((s) => String(s.cpf).replace(/\D/g, '')).filter((c) => c.length > 0))]
  if (cpfs.length === 0) {
    resultado.estadoFonte = 'aguardando'
    return resultado
  }
  const listaCpfs = cpfs.map((c) => `'${c}'`).join(',')
  const linhasPacientes = await deps.sql.query<{ ID: number; CPF: string | null }>(
    `SELECT ${MAPEAMENTO.paciente.chave}, CPF
     FROM ${MAPEAMENTO.paciente.tabela}
     WHERE REPLACE(REPLACE(REPLACE(CPF, '.', ''), '-', ''), ' ', '') IN (${listaCpfs})`,
  )
  // PACIENTE.ID → sessão: 1º CPF normalizado que casar vence; entrada existente não é sobrescrita.
  const mapa = new Map<number, SessaoAberta>()
  for (const linha of linhasPacientes.recordset) {
    const cpfLinha = String(linha.CPF ?? '').replace(/\D/g, '')
    if (!cpfLinha) continue
    const sessao = sessoes.find((s) => String(s.cpf).replace(/\D/g, '') === cpfLinha)
    if (sessao && !mapa.has(linha.ID)) mapa.set(linha.ID, sessao)
  }
  const idsPacientes = [...mapa.keys()]
  if (idsPacientes.length === 0) {
    resultado.estadoFonte = 'aguardando'
    return resultado
  }
  const unidades = [...new Set(sessoes.map((s) => s.unit_local))]
  const limiteEdicao = new Date(agora().getTime() - JANELA_EDICAO_MIN * 60_000)
  const bruto = await lerFichas(deps.sql, idsPacientes, unidades, estado?.ultimaFichaId ?? 0, limiteEdicao)
  // C3: releitura de edições recentes — ficha editada na janela volta mesmo
  // com ID <= cursor (o hash muda → o ingest grava novo retrato).
  const janela = lerJanela(bruto, estado, agora())
  const { fichas, itens, pacientes } = janela
  resultado.fichasLidas = fichas.length

  // C3: cancelamento físico — IDs vistos recentes que SUMIRAM do banco viram
  // retrato com sourceStatus 'cancelada' (o Skip mostra o desfecho honesto).
  // Memória: id → timestamp em que foi visto (expira após 2h). Roda ANTES do
  // early-return: mesmo sem fichas novas, o sumiço precisa ser detectado.
  const memoria = deps.memoria ?? new Map<number, number>()
  const agoraMs = agora().getTime()
  for (const f of fichas) memoria.set(Number(f.ID), agoraMs)
  for (const [id, vistoEm] of memoria) {
    if (agoraMs - vistoEm > 2 * 60 * 60_000) memoria.delete(id)
  }
  const idsMemoria = [...memoria.keys()]
  const sumidos: number[] = []
  if (idsMemoria.length > 0) {
    const listaIds = idsMemoria.join(',')
    const r = await deps.sql.query<{ ID: number }>(
      `SELECT ID FROM ${MAPEAMENTO.ficha.tabela} WHERE ID IN (${listaIds})`,
    )
    const vivos = new Set(r.recordset.map((x) => Number(x.ID)))
    for (const id of idsMemoria) {
      if (!vivos.has(id)) {
        memoria.delete(id)
        sumidos.push(id)
      }
    }
  }
  if (fichas.length === 0 && sumidos.length === 0) {
    resultado.estadoFonte = 'aguardando'
    return resultado
  }

  // 5) Normaliza retratos (completeness exige itens); session_id vem da sessão que casou o CPF.
  const itensPorFicha = new Map<number, LinhaItem[]>()
  for (const it of itens) {
    const lista = itensPorFicha.get(it.SOLICITACAO_ID) ?? []
    lista.push(it)
    itensPorFicha.set(it.SOLICITACAO_ID, lista)
  }
  const pacPorId = new Map(pacientes.map((p) => [p.ID, p]))
  const retratos = fichas.map((f) =>
    normalizarFicha(
      f,
      itensPorFicha.get(f.ID) ?? [],
      pacPorId.get(f.PACIENTE) ?? null,
      mapa.get(f.PACIENTE)?.session_id ?? '',
      agora(),
    ),
  )
  for (const id of sumidos) {
    retratos.push(retratoCancelado(String(id), agora()))
  }

  // 6) Envelope para o Skip — roteado por session_id (a sessão certa resolve no Skip).
  // Mapa CPF→PACIENTE.ID: o Skip usa para vincular o pac_id à sessão (que abre pelo CPF).
  const mapaPacientes = [...mapa.entries()].map(([pacId, s]) => ({ cpf: s.cpf, pac_id: pacId }))
  const envelope: Envelope = {
    source: 'autolac',
    tenantRef: deps.tenantRef,
    unitRef: unidades[0],
    observedAt: agora().toISOString(),
    records: retratos,
    pacientes: mapaPacientes,
    nextCursor: null,
    completeness: retratos.every((r) => r.completeness === 'complete') ? 'complete' : 'partial',
  }

  // 7) Ingest; cursor avança só com 2xx.
  const { confirmados } = await deps.ingest.enviar(envelope)
  resultado.confirmados = confirmados
  resultado.retratosEnviados = retratos.length
  const idsConfirmados = fichas.filter((f) => confirmados.includes(String(f.ID))).map((f) => f.ID)
  const novoEstado = proximoCursor(estado, idsConfirmados)
  if (novoEstado && novoEstado !== estado) {
    await deps.cursor.salvar(novoEstado)
  }
  resultado.cursor = novoEstado
  resultado.estadoFonte = 'atualizado'
  return resultado
}

export type { SessaoAberta }