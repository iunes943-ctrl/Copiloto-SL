/**
 * sql.ts — acesso ao SQL Server do AutoLac. SOMENTE LEITURA.
 *
 * Regras (SPEC-1-003 / contrato §5):
 * - Nenhuma consulta de escrita sai daqui: guarda anti-escrita rejeita
 *   qualquer statement que não comece com SELECT.
 * - Estrutura conferida contra o mapeamento; divergência para a leitura (RN-13).
 * - Pool, timeout 10s, retries com espera progressiva (máx. 2, 1s/3s).
 *
 * Provas da sessão técnica de 21/10/2026 (06_notas/mapeamento-sql.md):
 *  - Ficha = SOLICITACAO (ID monotônico, nasce no salvar; exclusão é física)
 *  - Itens = SOLICITACAO_EXAMES (FK SOLICITACAO_ID, SITUACAO 'P' = pendente)
 *  - Paciente = PACIENTE (ID NÃO monotônico no tempo — nunca usar MAX(ID))
 *  - Convênio vive no PACIENTE (CONVENIO/PLANO → CONVENIO.IDENTIFICACAO)
 *  - Unidade = SOLICITACAO.LOCAL (nchar, ex. 'SL')
 *  - Atraso salvar→consultável ~zero; HORARIO é hora de abertura, não do salvar
 */
import sql, { type ConnectionPool, type IResult } from 'mssql'

export type SqlClient = {
  query<T = Record<string, unknown>>(statement: string, params?: Record<string, unknown>): Promise<IResult<T>>
  close(): Promise<void>
}

export const MAPEAMENTO = {
  ficha: {
    tabela: 'SOLICITACAO',
    chave: 'ID',
    colunas: ['ID', 'LOCAL', 'PROTOCOLO', 'DATA', 'PACIENTE', 'SUBTOTAL', 'DESCONTO', 'TOTAL', 'USUARIO_INCLUSAO', 'SITUACAO_ATENDIMENTO'] as const,
  },
  itens: {
    tabela: 'SOLICITACAO_EXAMES',
    chave: 'ID',
    fk: 'SOLICITACAO_ID',
    colunas: ['ID', 'SOLICITACAO_ID', 'EXAME', 'SITUACAO', 'ORDEM'] as const,
  },
  paciente: {
    tabela: 'PACIENTE',
    chave: 'ID',
    colunas: ['ID', 'NOME', 'CPF', 'DATANASCIMENTO', 'SEXO', 'CONVENIO', 'PLANO', 'INATIVO'] as const,
  },
  convencoes: {
    tabela: 'CONVENIO',
    chave: 'IDENTIFICACAO',
    colunas: ['IDENTIFICACAO', 'DESCRICAO'] as const,
  },
} as const

/** Guarda anti-escrita: rejeita qualquer statement que não seja SELECT/WITH. */
export function assegurarSomenteLeitura(statement: string): void {
  const s = statement.trim().toUpperCase()
  if (!s.startsWith('SELECT') && !s.startsWith('WITH')) {
    throw new Error('ERRO_FATALE: somente leitura — statement rejeitado: ' + s.slice(0, 40))
  }
  for (const proibida of ['INSERT ', 'UPDATE ', 'DELETE ', 'MERGE ', 'TRUNCATE ', 'EXEC ', 'EXECUTE ', 'DROP ', 'ALTER ', 'CREATE ']) {
    if (s.includes(proibida)) {
      throw new Error('ERRO_FATALE: somente leitura — statement contém "' + proibida.trim() + '"')
    }
  }
}

const RETRY_ESPERA_MS = [1000, 3000]

export function criarPool(cfg: {
  host: string
  port: number
  database: string
  user: string
  password: string
  encrypt: boolean
}): SqlClient {
  const config: sql.config = {
    server: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    options: {
      encrypt: cfg.encrypt,
      trustServerCertificate: false, // TLS validado — nunca ignorar erro de certificado em produção
      connectTimeout: 10_000,
      requestTimeout: 10_000,
    },
    pool: { max: 3, min: 0, idleTimeoutMillis: 30_000 },
  }

  let pool: ConnectionPool | null = null

  async function getPool(): Promise<ConnectionPool> {
    if (!pool || !pool.connected) {
      pool = await new sql.ConnectionPool(config).connect()
    }
    return pool
  }

  return {
    async query<T = Record<string, unknown>>(statement: string, params?: Record<string, unknown>): Promise<IResult<T>> {
      assegurarSomenteLeitura(statement)
      let ultimoErro: unknown
      for (let tentativa = 0; tentativa <= RETRY_ESPERA_MS.length; tentativa++) {
        try {
          const p = await getPool()
          const req = p.request()
          for (const [k, v] of Object.entries(params ?? {})) req.input(k, v)
          return await req.query<T>(statement)
        } catch (erro) {
          ultimoErro = erro
          const msg = String((erro as Error)?.message ?? erro)
          const transitorio = /timeout|ECONNRESET|EPIPE|ETIMEDOUT|socket|connection/i.test(msg)
          if (!transitorio || tentativa === RETRY_ESPERA_MS.length) break
          await new Promise((r) => setTimeout(r, RETRY_ESPERA_MS[tentativa]))
        }
      }
      throw ultimoErro
    },
    async close() {
      if (pool) await pool.close().catch(() => {})
      pool = null
    },
  }
}

/**
 * Verifica a estrutura contra o mapeamento (RN-13). Divergência → erro de estrutura
 * e a leitura para (o ciclo chama isto no começo; sem estrutura, sem leitura).
 */
export async function verificarEstrutura(cliente: SqlClient): Promise<void> {
  for (const [nome, def] of Object.entries(MAPEAMENTO)) {
    const colunas = [...def.colunas].join(', ')
    const r = await cliente.query<{ nome: string }>(
      `SELECT TOP 1 ${colunas} FROM ${def.tabela}`,
    )
    if (!r.recordset) {
      throw new Error('ERRO_ESTRUTURA: tabela ' + nome + ' (' + def.tabela + ') não respondeu')
    }
    void r.recordset[0]
    const esperadas = def.colunas as readonly string[]
    const r2 = await cliente.query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${def.tabela}'`,
    )
    const reais = new Set(r2.recordset.map((x) => x.COLUMN_NAME))
    for (const col of esperadas) {
      if (!reais.has(col)) {
        throw new Error('ERRO_ESTRUTURA: coluna ' + col + ' ausente em ' + def.tabela + ' (' + nome + ')')
      }
    }
  }
}

/** Prova de leitura (task 1): SELECT 1 do ambiente do worker. */
export async function provarLeitura(cliente: SqlClient): Promise<number> {
  const r = await cliente.query<{ prova: number }>('SELECT 1 AS prova')
  return r.recordset[0]?.prova ?? 0
}