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
  ler(): Promise<CursorStore leitura | null>