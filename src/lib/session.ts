// Contexto de unidade ativa do balcão (SPEC-1-001/C2).
// Troca/logout remove o contexto anterior: a chave única é sobrescrita ou removida.
const ACTIVE_UNIT_KEY = 'copiloto.active_unit_id'

export const setActiveUnit = (unitId: string): void => {
  localStorage.setItem(ACTIVE_UNIT_KEY, unitId)
}

export const getActiveUnitId = (): string | null => localStorage.getItem(ACTIVE_UNIT_KEY)

export const clearActiveUnit = (): void => {
  localStorage.removeItem(ACTIVE_UNIT_KEY)
}
