/**
 * ciclo.ts — um ciclo do worker: sessões abertas → leitura incremental → retratos → ingest → cursor.
 *
 * RN-11: lê só fichas das sessões abertas (paciente + unidade) desde o cursor; nunca a base inteira.
 * RN-12: retrato completo só quando cabeçalho e itens vieram; cursor avança após commit (2xx).
 * RN-13: estrutura diferente do mapeamento → leitura para com ERRO_ESTRUTURA.
 */
import type { SqlClient } from './sql.js'
import { MAPEAMENTO, verificarEstrutura } from './sql.js'
import type { SessoesClient, SessaoAberta } from './sessoes.js'
import type { IngestClient } from './ingest.js'
import type { CursorStore, CursorState } from './cursor.js'
import { proximoCursor } from './cursor.js'
import { normalizarFicha, type LinhaFicha, type LinhaItem, type LinhaPaciente, type Envelope } from './adaptador.js'

export type CicloDeps = {
  sql: SqlClient
  sessoes: SessoesClient
  ingest: IngestClient
  cursor: CursorStore
  tenantRef: string
  agora?: () => Date
}

export type ResultadoCiclo = {
  sessoesAbertas: number
  fichasLidas: number
  retratosEnviados: number
  confirmados: string[]
  cursor: CursorState | null
  estadoFonte: 'atualizado' | 'aguardando' | 'indisponivel' | 'leitura_parada'
}

/** Consulta parametrizada — os IDs vêm das sessões abertas, nunca concatenação. */
export async function lerFichas(
  cliente: SqlClient,
  idsPacientes: number[],
  unidades: string[],
  desdeFichaId: number,
): Promise<{ fichas: LinhaFicha[]; itens: LinhaItem[]; pacientes: LinhaPaciente[] }> {
  if (idsPacientes.length === 0 || unidades.length === 0) {
    return { fichas: [], itens: [], pacientes: [] }
  }
  const ids = idsPacientes.join(',')
  const locais = unidades.map((u) => `'${u.replace(/'/g, "''")}'`).join(',')
  const fichas = await cliente.query<LinhaFicha>(
    `SELECT ${MAPEAMENTO.ficha.colunas.join(', ')}
     FROM ${MAPEAMENTO.ficha.tabela}
     WHERE PACIENTE IN (${ids}) AND LOCAL IN (${locais}) AND ID > ${desdeFichaId}`,
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
  const { fichas, itens, pacientes } = await lerFichas(deps.sql, idsPacientes, unidades, estado?.ultimaFichaId ?? 0)
  resultado.fichasLidas = fichas.length
  if (fichas.length === 0) {
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