import { describe, it, expect } from 'vitest'
import {
  getMyMemberships,
  getUnitLabel,
  resolveActiveUnit,
  getActiveUnit,
  type MembershipView,
} from '@/services/memberships'
import { setActiveUnit, clearActiveUnit as clearStoredUnit } from '@/lib/session'

// Fixtures sintéticas de 01_insumos/fixtures-piloto.json (SPEC-1-001, cenário C2).
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
