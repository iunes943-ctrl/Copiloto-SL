/**
 * ingest.ts — envia retratos para o Skip (POST /backend/v1/autolac/ingest).
 * Idempotente por content_hash: 2xx confirma; o worker reenvia só o não confirmado.
 */
import type { Envelope } from './adaptador.js'

export type IngestClient = {
  enviar(envelope: Envelope): Promise<{ confirmados: string[] }>
}

export function criarIngestClient(cfg: { baseUrl: string; token: string }): IngestClient {
  return {
    async enviar(envelope: Envelope): Promise<{ confirmados: string[] }> {
      const r = await fetch(cfg.baseUrl + '/backend/v1/autolac/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Copiloto-Ingest': cfg.token,
        },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(10_000),
      })
      if (r.status === 401) throw new Error('INGEST_401: token inválido')
      if (r.status === 422) throw new Error('INGEST_422: tenant/unidade desconhecidos')
      if (!r.ok) throw new Error('INGEST_' + r.status)
      const corpo = (await r.json()) as { confirmados?: string[] }
      return { confirmados: corpo.confirmados ?? envelope.records.map((x) => x.encounterExternalId) }
    },
  }
}