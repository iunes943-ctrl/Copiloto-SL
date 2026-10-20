// Vínculos usuário↔unidade (SPEC-1-001). Módulo puro: sem acesso ao backend.
// A sessão do balcão só inicia com unidade autorizada: vínculo ativo escolhido
// pela atendente e resolvido contra a lista de vínculos do usuário — nunca
// contra valor solto do navegador. canUseUnit é a guarda de autorização.
import { getActiveUnitId, setActiveUnit, clearActiveUnit as clearSessionUnit } from '@/lib/session'

export interface MembershipView {
  id: string
  unit_id: string
  unit_name: string
  tenant_id: string
  roles: string[]
  active: boolean
}

export const getMyMemberships = (memberships: MembershipView[]): MembershipView[] =>
  memberships.filter((m) => m.active)

export const getUnitLabel = (m: MembershipView): string => m.unit_name

export const resolveActiveUnit = (memberships: MembershipView[]): MembershipView | null => {
  const id = getActiveUnitId()
  if (!id) return null
  const match = memberships.filter((m) => m.active && m.unit_id === id)
  return match.length > 0 ? match[0] : null
}

export const getActiveUnit = (): { unit_id: string } | null => {
  const id = getActiveUnitId()
  return id ? { unit_id: id } : null
}

export const clearActiveUnit = (): void => {
  clearSessionUnit()
}

export const chooseUnit = (unitId: string): void => {
  setActiveUnit(unitId)
}

export const canUseUnit = (memberships: MembershipView[], unitId: string): boolean =>
  memberships.some((m) => m.active && m.unit_id === unitId)
