// Papéis e alçada de concessão (SPEC-1-001/C3).
// Papéis administrativos só existem por concessão explícita e auditada:
// quem concede precisa de alçada (admin/director), não pode conceder a si
// mesmo e todo papel precisa estar na lista do sistema. A concessão via API
// é única e auditada (rota backend); memberships está selado ao cliente.
export const PAPEIS_SISTEMA = [
  'attendant',
  'leader',
  'manager',
  'director',
  'admin',
  'curator_technical',
  'curator_commercial',
] as const

export type PapelSistema = (typeof PAPEIS_SISTEMA)[number]

export const ALCADAS_CONCESSAO: readonly string[] = ['admin', 'director']

export interface AlvoConcessao {
  user_id: string
  roles: string[]
}

export const podeConceder = (
  actorRoles: string[],
  actorUserId: string,
  alvo: AlvoConcessao,
): boolean => {
  const temAlcada = actorRoles.some((r) => ALCADAS_CONCESSAO.includes(r))
  if (!temAlcada) return false
  if (alvo.user_id === actorUserId) return false
  return (
    alvo.roles.length > 0 &&
    alvo.roles.every((r) => (PAPEIS_SISTEMA as readonly string[]).includes(r))
  )
}
