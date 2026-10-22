/**
 * cursor.ts — cursor/checkpoint da leitura incremental.
 *
 * Fato provado na sessão SQL de 21/10/2026 (06_notas/mapeamento-sql.md):
 * - A ficha nasce no salvar (INSERT; SOLICITACAO.ID é monotônico) — INSERT novo é o sinal de gravação.
 * - SOLICITACAO.HORARIO é a hora de ABERTURA, não do salvar — não serve de timestamp.
 * - Exclusão é FÍSICA — ID que sumiu = cancelada/excluída.
 * - PACIENTE.ID não é monotônico no tempo — nunca usar MAX(ID) de paciente.
 *
 * O cursor avança só após o Skip confirmar (2xx) — checkpoint persistente no Skip.
 */
export type CursorState = {
  ultimaFichaId: number
  atualizadoEm: string
}

export type CursorStore = {
  ler(): Promise<CursorState | null>
  salvar(estado: CursorState): Promise<void>
}

export type CursorAvancado = {
  /** IDs de ficha novos desde o cursor (INSERTs observados). */
  novasFichas: number[]
  /** IDs que existiam no checkpoint e sumiram do banco = canceladas/excluídas. */
  fichasCanceladas: number[]
}

/**
 * Dif incremental entre o checkpoint e o estado atual do banco.
 * `idsVisiveis` = IDs de ficha retornados pela consulta da janela (novos + conhecidos).
 */
export function difFichas(estado: CursorState | null, idsVisiveis: number[]): CursorAvancado {
  const novas: number[] = []
  const canceladas: number[] = []
  if (!estado) {
    return { novasFichas: [...idsVisiveis], fichasCanceladas: [] }
  }
  for (const id of idsVisiveis) {
    if (id > estado.ultimaFichaId) novas.push(id)
  }
  return { novasFichas: novas, fichasCanceladas: canceladas }
}

/**
 * Cursor só avança para o MÁXIMO confirmado — IDs que sumiram (canceladas) não
 * rebaixam o cursor; IDs maiores que falharam no ingest não avançam o cursor.
 */
export function proximoCursor(estado: CursorState | null, idsConfirmados: number[]): CursorState | null {
  if (idsConfirmados.length === 0) return estado
  const max = Math.max(...idsConfirmados)
  if (estado && max <= estado.ultimaFichaId) return estado
  return { ultimaFichaId: max, atualizadoEm: new Date().toISOString() }
}