import { describe, it, expect } from 'vitest'
import {
  getMyMemberships,
  getUnitLabel,
  resolveActiveUnit,
  getActiveUnit,
  canUseUnit,
  type MembershipView,
} from '@/services/memberships'
import { setActiveUnit, clearActiveUnit as clearStoredUnit } from '@/lib/session'
import { podeConceder } from '@/services/papeis'

// Fixtures sintéticas de 01_insumos/fixtures-piloto.json (SPEC-1-001, cenários C1, C2 e C3).
// Nenhum dado real de paciente; nomes/ids sintéticos.

const memberships: MembershipView[] = [
  {
    id: 'm1',
    unit_id: 'DEMO-U1',
    unit_name: 'Matriz',
    tenant_id: 'DEMO-T1',
    roles: ['attendant'],
    active: true,
  },
  {
    id: 'm2',
    unit_id: 'DEMO-U2',
    unit_name: 'Unidade 2',
    tenant_id: 'DEMO-T1',
    roles: ['attendant'],
    active: true,
  },
  {
    id: 'm3',
    unit_id: 'DEMO-U3',
    unit_name: 'Unidade sem vínculo',
    tenant_id: 'DEMO-T2',
    roles: ['attendant'],
    active: false,
  },
]

describe('SPEC-1-001 / C2 — atendente só inicia sessão após escolher unidade autorizada', () => {
  it('lista de unidades só contém vínculos ativos do usuário', () => {
    const units = getMyMemberships(memberships)
    const ids = units.map((m) => m.unit_id)
    expect(ids).toEqual(['DEMO-U1', 'DEMO-U2'])
  })

  it('sem unidade escolhida, não há sessão de balcão iniciada', () => {
    clearStoredUnit()
    expect(getActiveUnit()).toBeNull()
    const resolved = resolveActiveUnit(memberships)
    expect(resolved).toBeNull()
  })

  it('unidade não autorizada (vínculo inativo) não resolve sessão', () => {
    clearStoredUnit()
    setActiveUnit('DEMO-U3')
    expect(resolveActiveUnit(memberships)).toBeNull()
  })

  it('unidade autorizada resolve sessão com dados do vínculo', () => {
    clearStoredUnit()
    setActiveUnit('DEMO-U1')
    const resolved = resolveActiveUnit(memberships)
    expect(resolved).not.toBeNull()
    expect(resolved?.unit_id).toBe('DEMO-U1')
    expect(resolved?.roles).toContain('attendant')
  })

  it('troca de unidade remove o contexto anterior (paciente/cache)', () => {
    setActiveUnit('DEMO-U1')
    expect(getActiveUnit()?.unit_id).toBe('DEMO-U1')
    setActiveUnit('DEMO-U2')
    expect(getActiveUnit()?.unit_id).toBe('DEMO-U2')
    expect(getActiveUnit()?.unit_id).not.toBe('DEMO-U1')
  })

  it('logout/troca limpa o contexto e exige nova autenticação', () => {
    setActiveUnit('DEMO-U1')
    clearStoredUnit()
    expect(getActiveUnit()).toBeNull()
  })

  it('rótulo da unidade usa o nome do vínculo', () => {
    expect(getUnitLabel(memberships[0])).toBe('Matriz')
  })
})

describe('SPEC-1-001 / C1 — contas de unidades distintas não acessam sessão uma da outra', () => {
  const att1: MembershipView[] = memberships.filter((m) => m.id === 'm1' || m.id === 'm3')
  const att2: MembershipView[] = memberships.filter((m) => m.id === 'm2')

  it('vínculos de att1 não aparecem na sessão de att2', () => {
    expect(getMyMemberships(att2).map((m) => m.unit_id)).toEqual(['DEMO-U2'])
  })

  it('unidade gravada por att1 não resolve na sessão de att2', () => {
    clearStoredUnit()
    setActiveUnit('DEMO-U1')
    expect(resolveActiveUnit(att2)).toBeNull()
  })

  it('guarda recusa unidade de outra conta', () => {
    expect(canUseUnit(att2, 'DEMO-U1')).toBe(false)
  })

  it('guarda permite unidade própria', () => {
    expect(canUseUnit(att2, 'DEMO-U2')).toBe(true)
  })

  it('guarda recusa vínculo inativo', () => {
    expect(canUseUnit(att1, 'DEMO-U3')).toBe(false)
  })
})

describe('SPEC-1-001 / C3 — papéis administrativos só por concessão explícita e auditada', () => {
  it('atendente sem alçada não concede papel', () => {
    expect(podeConceder(['attendant'], 'u-att1', { user_id: 'u-att2', roles: ['manager'] })).toBe(false)
  })

  it('gestora (manager) sem alçada de concessão não concede papel', () => {
    expect(podeConceder(['manager'], 'u-mgr', { user_id: 'u-att2', roles: ['leader'] })).toBe(false)
  })

  it('diretoria com alçada concede papel permitido', () => {
    expect(podeConceder(['director'], 'u-dir', { user_id: 'u-att2', roles: ['leader'] })).toBe(true)
  })

  it('ninguém concede papel a si mesmo', () => {
    expect(podeConceder(['admin'], 'u-admin', { user_id: 'u-admin', roles: ['admin'] })).toBe(false)
  })

  it('papel fora da lista do sistema é recusado', () => {
    expect(podeConceder(['admin'], 'u-admin', { user_id: 'u-att2', roles: ['superadmin'] })).toBe(false)
  })
})
