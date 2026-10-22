/**
 * Testes de aceitação SPEC-1-003 — leitura da ficha gravada no AutoLac pelo worker.
 * Cenários da SPEC (C1/C2/C3) com cliente mssql falso fiel ao mapeamento real
 * (sessão SQL de 21/10/2026): ficha nasce no salvar (INSERT), HORARIO é hora de
 * abertura, exclusão é física, PACIENTE.ID não é monotônico.
 */
import { describe, it, expect, vi } from 'vitest'
import { assegurarSomenteLeitura, MAPEAMENTO, verificarEstrutura, provarLeitura, type SqlClient } from '../../src/sql.js'
import { difFichas, proximoCursor, type CursorState } from '../../src/cursor.js'
import { normalizarFicha, perfilDoPaciente, type LinhaFicha, type LinhaItem, type LinhaPaciente } from '../../src/adaptador.js'
import { rodarCiclo, type CicloDeps } from '../../src/ciclo.js'
import type { SessoesClient, SessaoAberta } from '../../src/sessoes.js'
import type { IngestClient } from '../../src/ingest.js'

// ---------- Fixtures fiéis ao mapeamento real (sem dados pessoais) ----------

const FICHA: LinhaFicha = {
  ID: 1477558,
  LOCAL: 'SL',
  PROTOCOLO: 298802,
  DATA: '2026-10-21',
  PACIENTE: 1542377,
  SUBTOTAL: 22.59,
  DESCONTO: 0,
  TOTAL: 22.59,
  USUARIO_INCLUSAO: 'ABILIO IUNES',
}

const ITEM_OP: LinhaItem = { ID: 9144600, SOLICITACAO_ID: 1477558, EXAME: 'OP', SITUACAO: 'P', ORDEM: 1 }

const PACIENTE_PARTICULAR: LinhaPaciente = {
  ID: 1542377,
  NOME: 'PACIENTE DEMO',
  CPF: null,
  DATANASCIMENTO: '1980-01-01',
  SEXO: 'F',
  CONVENIO: null,
  PLANO: null,
  INATIVO: 'F',
}

const PACIENTE_PLANO: LinhaPaciente = { ...PACIENTE_PARTICULAR, ID: 1542378, CONVENIO: 'UNIMED', PLANO: 'NACIONAL PLUS' }

function clienteFalso(tabelas: {
  fichas?: LinhaFicha[]
  itens?: LinhaItem[]
  pacientes?: LinhaPaciente[]
  colunas?: Record<string, string[]>
  falhar?: (statement: string) => never
}): SqlClient & { consultas: string[] } {
  const consultas: string[] = []
  const colunasDefault = Object.fromEntries(
    Object.values(MAPEAMENTO).map((d) => [d.tabela, [...d.colunas]]),
  ) as Record<string, string[]>
  return {
    consultas,
    async query<T>(statement: string): Promise<{ recordset: T[] }> {
      consultas.push(statement)
      if (tabelas.falhar) tabelas.falhar(statement)
      const s = statement.toUpperCase()
      if (s.includes('SELECT 1')) return { recordset: [{ prova: 1 }] as unknown as T[] }
      if (s.includes('INFORMATION_SCHEMA.COLUMNS')) {
        const nome = /TABLE_NAME = '([^']+)'/.exec(statement)?.[1] ?? ''
        return { recordset: (tabelas.colunas?.[nome] ?? colunasDefault[nome] ?? []).map((c) => ({ COLUMN_NAME: c })) as unknown as T[] }
      }
      // Falso interpreta os filtros que o ciclo usa (ordem: tabela mais específica primeiro)
      const idsIn = (campo: string): number[] =>
        new RegExp(campo + '\\s+IN\\s+\\(([^)]+)\\)').exec(statement)?.[1]
          ?.split(',')
          .map((x) => Number(x.trim()))
          .filter(Number.isFinite) ?? []
      const locaisIn = /LOCAL\s+IN\s+\(([^)]+)\)/.exec(statement)?.[1]
        ?.split(',')
        .map((x) => x.trim().replace(/^'|'$/g, '')) ?? []
      const idMaior = /ID\s*>\s*(\d+)/.exec(statement)?.[1]
      if (s.includes(MAPEAMENTO.itens.tabela)) {
        const ids = idsIn('SOLICITACAO_ID')
        return { recordset: (tabelas.itens ?? []).filter((i) => ids.includes(i.SOLICITACAO_ID)) as unknown as T[] }
      }
      if (s.includes(MAPEAMENTO.ficha.tabela)) {
        const pacs = idsIn('PACIENTE')
        let fichas = (tabelas.fichas ?? []).filter((f) => pacs.includes(f.PACIENTE))
        if (locaisIn.length > 0) fichas = fichas.filter((f) => locaisIn.includes(f.LOCAL))
        if (idMaior) fichas = fichas.filter((f) => f.ID > Number(idMaior))
        return { recordset: fichas as unknown as T[] }
      }
      if (s.includes(MAPEAMENTO.paciente.tabela)) {
        const ids = idsIn('ID')
        return { recordset: (tabelas.pacientes ?? []).filter((p) => ids.includes(p.ID)) as unknown as T[] }
      }
      return { recordset: [] as unknown as T[] }
    },
    async close() {},
  }
}

function sessoesFalsas(lista: SessaoAberta[]): SessoesClient {
  return { async listarSessoesAbertas() { return lista } }
}

function ingestFalso(resposta: { ok: boolean; confirmados?: string[] } & { enviados: EnvelopeCapturado[] }): IngestClient {
  return {
    async enviar(envelope) {
      resposta.enviados.push(envelope)
      if (!resposta.ok) throw new Error('INGEST_500')
      return { confirmados: resposta.confirmados ?? envelope.records.map((r) => r.encounterExternalId) }
    },
  }
}

type EnvelopeCapturado = {
  source: string
  tenantRef: string
  unitRef: string
  records: { encounterExternalId: string; patientExternalId: string; profile: string; items: { examCode: string }[]; completeness: string }[]
  completeness: string
}

function cursorFalso(estadoInicial: CursorState | null) {
  let estado = estadoInicial
  const salvo: CursorState[] = []
  return {
    salvo,
    async ler() { return estado },
    async salvar(e: CursorState) { estado = e; salvo.push(e) },
  }
}

function depsCom(
  sql: SqlClient,
  sessoes: SessoesClient,
  ingest: IngestClient,
  cursor: ReturnType<typeof cursorFalso>,
): CicloDeps {
  return { sql, sessoes, ingest, cursor, tenantRef: 'DEMO-T1', agora: () => new Date('2026-10-21T20:00:00Z') }
}

const SESSAO = (cpf: string, local = 'SL'): SessaoAberta => ({ session_id: 'DEMO-SES1', unit_local: local, cpf })

// ---------- C1 → CA-1-003-1 ----------

describe('SPEC-1-003 C1 — leitura da ficha (prova de leitura)', () => {
  it('SPEC-1-003 C1: ciclo com sessão aberta lê a ficha gravada e envia retrato completo, sem escrita', async () => {
    const sql = clienteFalso({ fichas: [FICHA], itens: [ITEM_OP], pacientes: [PACIENTE_PARTICULAR] })
    const enviados: EnvelopeCapturado[] = []
    const cursor = cursorFalso(null)
    const deps = depsCom(sql, sessoesFalsas([SESSAO('1542377')]), ingestFalso({ ok: true, enviados }), cursor)

    const r = await rodarCiclo(deps)

    expect(r.estadoFonte).toBe('atualizado')
    expect(enviados).toHaveLength(1)
    const env = enviados[0]
    expect(env.source).toBe('autolac')
    expect(env.tenantRef).toBe('DEMO-T1')
    expect(env.unitRef).toBe('SL')
    expect(env.records).toHaveLength(1)
    const retrato = env.records[0]
    expect(retrato.encounterExternalId).toBe('1477558')
    expect(retrato.patientExternalId).toBe('1542377')
    expect(retrato.profile).toBe('particular') // CONVENIO NULL = particular (prova da sessão)
    expect(retrato.completeness).toBe('complete')
    expect(retrato.items).toEqual([{ examCode: 'OP', quantity: 1, status: 'P' }])
    // Nenhuma consulta de escrita registrada
    for (const c of sql.consultas) {
      expect(c.trim().toUpperCase().startsWith('SELECT')).toBe(true)
    }
    // CPF do paciente nunca aparece em log — aqui, nunca em campo além do filtro parametrizado
    expect(env.records[0]).not.toHaveProperty('cpf')
  })

  it('SPEC-1-003 C1: guarda anti-escrita rejeita statement de escrita e estrutura divergente para a leitura', async () => {
    expect(() => assegurarSomenteLeitura('UPDATE SOLICITACAO SET TOTAL = 0')).toThrow(/somente leitura/i)
    expect(() => assegurarSomenteLeitura('DELETE FROM SOLICITACAO_EXAMES')).toThrow(/somente leitura/i)
    expect(() => assegurarSomenteLeitura('SELECT ID FROM SOLICITACAO')).not.toThrow()

    // Estrutura sem a coluna do mapeamento → ERRO_ESTRUTURA (RN-13)
    const colunas = Object.fromEntries(
      Object.values(MAPEAMENTO).map((d) => [d.tabela, [...d.colunas]]),
    ) as Record<string, string[]>
    delete colunas['SOLICITACAO']
    colunas['SOLICITACAO'] = (MAPEAMENTO.ficha.colunas.filter((c) => c !== 'PACIENTE') as unknown as string[]).slice()
    const sql = clienteFalso({ colunas })
    await expect(verificarEstrutura(sql)).rejects.toThrow(/ERRO_ESTRUTURA/)
  })

  it('SPEC-1-003 C1: SELECT 1 prova leitura do ambiente', async () => {
    const sql = clienteFalso({})
    expect(await provarLeitura(sql)).toBe(1)
  })
})

// ---------- C2 → CA-1-003-2 ----------

describe('SPEC-1-003 C2 — retrato único, roteado, cursor após confirmação', () => {
  it('SPEC-1-003 C2: leitura repetida não duplica; cursor só avança após 2xx; outra unidade não recebe', async () => {
    const sql = clienteFalso({ fichas: [FICHA], itens: [ITEM_OP], pacientes: [PACIENTE_PARTICULAR] })
    const enviados: EnvelopeCapturado[] = []
    const cursor = cursorFalso(null)

    // Ciclo 1: ingest falha → cursor não avança
    const depsFalha = depsCom(sql, sessoesFalsas([SESSAO('1542377')]), ingestFalso({ ok: false, enviados }), cursor)
    await expect(rodarCiclo(depsFalha)).rejects.toThrow(/INGEST_500/)
    expect(cursor.salvo).toHaveLength(0)

    // Ciclo 2: ingest confirma → cursor avança para 1477558
    const depsOk = depsCom(sql, sessoesFalsas([SESSAO('1542377')]), ingestFalso({ ok: true, confirmados: ['1477558'], enviados }), cursor)
    const r = await rodarCiclo(depsOk)
    expect(cursor.salvo).toHaveLength(1)
    expect(cursor.salvo[0].ultimaFichaId).toBe(1477558)
    expect(r.confirmados).toContain('1477558')

    // Ciclo 3: mesma ficha repetida — cursor já avançou; consulta incremental não traz de novo
    const sql3 = clienteFalso({ fichas: [], itens: [], pacientes: [] })
    const enviados3: EnvelopeCapturado[] = []
    const deps3 = depsCom(sql3, sessoesFalsas([SESSAO('1542377')]), ingestFalso({ ok: true, enviados: enviados3 }), cursor)
    const r3 = await rodarCiclo(deps3)
    expect(r3.estadoFonte).toBe('aguardando')
    expect(enviados3).toHaveLength(0)

    // Sessão em outra unidade: ficha é de SL, sessão pede PM → nada lido
    const enviados4: EnvelopeCapturado[] = []
    const deps4 = depsCom(sql, sessoesFalsas([SESSAO('1542377', 'PM')]), ingestFalso({ ok: true, enviados: enviados4 }), cursor)
    const r4 = await rodarCiclo(deps4)
    expect(r4.fichasLidas).toBe(0)
    expect(enviados4).toHaveLength(0)
  })

  it('SPEC-1-003 C2: retrato parcial (sem itens) não vira complete; perfil plano resolve pelo convênio do paciente', async () => {
    const retratoParcial = normalizarFicha(FICHA, [], PACIENTE_PARTICULAR)
    expect(retratoParcial.completeness).toBe('partial')

    const retratoCompleto = normalizarFicha(FICHA, [ITEM_OP], PACIENTE_PLANO)
    expect(retratoCompleto.completeness).toBe('complete')
    expect(retratoCompleto.profile).toBe('plano')
    expect(perfilDoPaciente({ CONVENIO: null, PLANO: null })).toBe('particular')
  })
})

// ---------- C3 → CA-1-003-3 ----------

describe('SPEC-1-003 C3 — indisponibilidade, estrutura alterada, cancelamento e reinício', () => {
  it('SPEC-1-003 C3: timeout no SQL → estado indisponível com retries limitados; cursor preservado', async () => {
    let tentativas = 0
    const sql = clienteFalso({
      falhar: (statement: string): never => {
        if (statement.includes('INFORMATION_SCHEMA')) {
          tentativas++
          const e = new Error('Timeout: request timed out') as Error & { code?: string }
          throw e
        }
        throw new Error('não deveria chegar aqui')
      },
    })
    const cursor = cursorFalso({ ultimaFichaId: 1477550, atualizadoEm: '2026-10-21T19:00:00Z' })
    const deps = depsCom(sql, sessoesFalsas([SESSAO('1542377')]), ingestFalso({ ok: true, enviados: [] }), cursor)
    await expect(rodarCiclo(deps)).rejects.toThrow()
    expect(tentativas).toBeLessThanOrEqual(3) // 1 + 2 retries, sem retry agressivo
    expect(cursor.salvo).toHaveLength(0) // cursor preservado
  })

  it('SPEC-1-003 C3: ficha cancelada (ID sumiu) não gera retrato; reinício retoma do checkpoint', async () => {
    // Banco vazio: ficha 1477558 foi excluída fisicamente (prova da sessão SQL)
    const sql = clienteFalso({ fichas: [], itens: [], pacientes: [] })
    const enviados: EnvelopeCapturado[] = []
    const cursor = cursorFalso({ ultimaFichaId: 1477557, atualizadoEm: '2026-10-21T19:00:00Z' })
    const deps = depsCom(sql, sessoesFalsas([SESSAO('1542377')]), ingestFalso({ ok: true, enviados }), cursor)
    const r = await rodarCiclo(deps)
    expect(r.fichasLidas).toBe(0)
    expect(enviados).toHaveLength(0)
    // Reinício: cursor intacto retoma do checkpoint
    expect(cursor.salvo).toHaveLength(0)
  })

  it('SPEC-1-003 C3: dif incremental marca canceladas e cursor nunca rebaixa', () => {
    const estado: CursorState = { ultimaFichaId: 1477558, atualizadoEm: '2026-10-21T19:00:00Z' }
    // IDs visíveis abaixo do cursor → nada novo
    expect(difFichas(estado, [1477550, 1477551]).novasFichas).toEqual([])
    // ID acima → novo
    expect(difFichas(estado, [1477559]).novasFichas).toEqual([1477559])
    // Cursor nunca rebaixa: confirmação de ID menor não move
    expect(proximoCursor(estado, [1477550])).toEqual(estado)
    expect(proximoCursor(estado, [1477560])?.ultimaFichaId).toBe(1477560)
    expect(proximoCursor(null, [1, 2, 3])?.ultimaFichaId).toBe(3)
  })
})