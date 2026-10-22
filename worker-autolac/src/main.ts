/**
 * main.ts — loop contínuo do worker.
 *
 * Ambiente (M5): requer AUTOLAC_SQL_* e AUTOLAC_INGEST_TOKEN no gerenciador de segredos.
 * Sem segredos, o worker NÃO sobe em modo real (SPEC: parar e pedir validação).
 * TCP 754 não é alcançável do sandbox — rodar em container/VM com saída até
 * 0754.dbserver.autolac.com.br:754 (decisão M5 na sessão técnica).
 */
import { criarPool, verificarEstrutura, provarLeitura, type SqlClient } from './sql.js'
import { criarSessoesClient } from './sessoes.js'
import { criarIngestClient } from './ingest.js'
import { rodarCiclo } from './ciclo.js'
import type { CursorStore } from './cursor.js'

function env(obrigatorio: string, nome: string): string {
  const v = process.env[nome]
  if (!v) {
    console.error(`[worker] ${nome} ausente — ${obrigatorio}. Saindo.`)
    process.exit(1)
  }
  return v
}

const SKIP_BACKEND_URL = env('URL do backend do Skip', 'SKIP_BACKEND_URL')
const TOKEN = env('token de ingest', 'AUTOLAC_INGEST_TOKEN')
const INTERVALO_S = Number(process.env.AUTOLAC_POLL_INTERVAL_S ?? '60')

const sqlCliente: SqlClient = criarPool({
  host: env('host do SQL do AutoLac', 'AUTOLAC_SQL_HOST'),
  port: Number(env('porta do SQL do AutoLac', 'AUTOLAC_SQL_PORT')),
  database: env('banco do AutoLac', 'AUTOLAC_SQL_DATABASE'),
  user: env('usuário de integração só leitura', 'AUTOLAC_SQL_USER'),
  password: env('senha do usuário de integração', 'AUTOLAC_SQL_PASSWORD'),
  encrypt: (process.env.AUTOLAC_SQL_ENCRYPT ?? 'true') === 'true',
})

const sessoes = criarSessoesClient({ baseUrl: SKIP_BACKEND_URL, token: TOKEN })
const ingest = criarIngestClient({ baseUrl: SKIP_BACKEND_URL, token: TOKEN })

// Cursor/checkpoint persistente no Skip (coleção sync_cursors) — via rota autenticada.
const cursor: CursorStore = {
  async ler() {
    const r = await fetch(SKIP_BACKEND_URL + '/backend/v1/autolac/cursor', {
      headers: { 'X-Copiloto-Ingest': TOKEN },
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) return null
    const corpo = (await r.json()) as { cursor?: { ultimaFichaId?: number; atualizadoEm?: string } | null }
    if (!corpo.cursor?.ultimaFichaId) return null
    return { ultimaFichaId: corpo.cursor.ultimaFichaId, atualizadoEm: corpo.cursor.atualizadoEm ?? new Date().toISOString() }
  },
  async salvar(estado) {
    await fetch(SKIP_BACKEND_URL + '/backend/v1/autolac/cursor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Copiloto-Ingest': TOKEN },
      body: JSON.stringify({ ultimaFichaId: estado.ultimaFichaId, atualizadoEm: estado.atualizadoEm }),
      signal: AbortSignal.timeout(10_000),
    })
  },
}

async function main(): Promise<void> {
  console.log('[worker] iniciando — prova de leitura (SELECT 1)...')
  const prova = await provarLeitura(sqlCliente)
  if (prova !== 1) throw new Error('SELECT 1 falhou do ambiente do worker')
  console.log('[worker] SELECT 1 OK — verificando estrutura contra o mapeamento...')
  await verificarEstrutura(sqlCliente)
  console.log('[worker] estrutura OK — loop iniciado (intervalo ' + INTERVALO_S + 's)')

  let espera = 1000
  for (;;) {
    try {
      const r = await rodarCiclo({ sql: sqlCliente, sessoes, ingest, cursor, tenantRef: 'SL' })
      console.log(
        `[worker] ciclo: sessoes=${r.sessoesAbertas} lidas=${r.fichasLidas} enviados=${r.retratosEnviados} fonte=${r.estadoFonte}`,
      )
      espera = 1000
    } catch (e) {
      const msg = String((e as Error)?.message ?? e)
      // Nunca loga CPF/dados de paciente — só a classe do erro.
      console.error('[worker] ciclo falhou: ' + msg.slice(0, 120))
      await new Promise((r) => setTimeout(r, espera))
      espera = Math.min(espera * 2, 60_000) // espera progressiva, sem retry agressivo
    }
    await new Promise((r) => setTimeout(r, INTERVALO_S * 1000))
  }
}

main().catch((e) => {
  console.error('[worker] fatal: ' + String((e as Error)?.message ?? e).slice(0, 200))
  process.exit(1)
})