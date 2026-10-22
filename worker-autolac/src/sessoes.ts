/**
 * sessoes.ts — busca sessões abertas no Skip (rota autenticada).
 * O worker só consulta pacientes com sessão aberta — nunca a base inteira (RN-11).
 */
export type SessaoAberta = {
  session_id: string
  unit_local: string // código `local` do AutoLac (ex.: SL)
  cpf: string // só em memória; nunca em log
}

export type SessoesClient = {
  listarSessoesAbertas(): Promise<SessaoAberta[]>
}

export function criarSessoesClient(cfg: { baseUrl: string; token: string }): SessoesClient {
  return {
    async listarSessoesAbertas(): Promise<SessaoAberta[]> {
      const r = await fetch(cfg.baseUrl + '/backend/v1/autolac/sessoes-abertas', {
        headers: { 'X-Copiloto-Ingest': cfg.token },
        signal: AbortSignal.timeout(10_000),
      })
      if (r.status === 401) throw new Error('SESSOES_401: token inválido')
      if (!r.ok) throw new Error('SESSOES_' + r.status)
      const corpo = (await r.json()) as { sessoes?: SessaoAberta[] }
      return corpo.sessoes ?? []
    },
  }
}