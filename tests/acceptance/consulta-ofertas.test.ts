import { describe, it, expect } from 'vitest'
import { consultarOferta, pausaInvalidaUso } from '@/services/consultaOfertas'

// Massa sintética: ofertas com unidade, vigência e preço (SPEC-1-002/C3).
// O filtro de perfil acontece na rota de consulta (coleção não tem campo
// perfil por enquanto); o preço cai para a referência quando o final é vazio.
const oferta = (over: Partial<Record<string, unknown>>) => ({
  exam_key: 'HBHUMA',
  price_final: '18.27',
  price_reference: '18.27',
  perfil: 'particular',
  unit_id: 'U1',
  vigencia_inicio: '2026-01-01',
  vigencia_fim: '2027-12-31',
  active: true,
  aprovacao_tecnica: true,
  aprovacao_comercial: true,
  ...over,
})

const AGORA = new Date('2026-10-21T12:00:00Z')

describe('SPEC-1-002 / C3 — consulta respeita tabela, vigência e unidade; pausa invalida uso futuro', () => {
  it('retorna oferta ativa, em vigência, da unidade', () => {
    const r = consultarOferta([oferta({})], { examKey: 'HBHUMA', perfil: 'particular', unitId: 'U1', agora: AGORA })
    expect(r).not.toBeNull()
    expect(r?.preco).toBe('18.27')
  })

  it('não retorna oferta pausada (uso futuro invalidado)', () => {
    const r = consultarOferta([oferta({ active: false })], { examKey: 'HBHUMA', perfil: 'particular', unitId: 'U1', agora: AGORA })
    expect(r).toBeNull()
  })

  it('não retorna oferta fora da vigência (expirada)', () => {
    const r = consultarOferta([oferta({ vigencia_fim: '2026-09-30' })], { examKey: 'HBHUMA', perfil: 'particular', unitId: 'U1', agora: AGORA })
    expect(r).toBeNull()
  })

  it('não retorna oferta ainda não vigente', () => {
    const r = consultarOferta([oferta({ vigencia_inicio: '2099-01-01' })], { examKey: 'HBHUMA', perfil: 'particular', unitId: 'U1', agora: AGORA })
    expect(r).toBeNull()
  })

  it('não retorna oferta de outra unidade', () => {
    const r = consultarOferta([oferta({ unit_id: 'U2' })], { examKey: 'HBHUMA', perfil: 'particular', unitId: 'U1', agora: AGORA })
    expect(r).toBeNull()
  })

  it('preço vazio cai para a referência (nunca inventa preço)', () => {
    const r = consultarOferta([oferta({ price_final: '' })], { examKey: 'HBHUMA', perfil: 'particular', unitId: 'U1', agora: AGORA })
    expect(r?.preco).toBe('18.27')
  })

  it('sem preço nenhum (final e referência vazios) retorna null', () => {
    const r = consultarOferta([oferta({ price_final: '', price_reference: '' })], { examKey: 'HBHUMA', perfil: 'particular', unitId: 'U1', agora: AGORA })
    expect(r).toBeNull()
  })

  it('pausa invalida uso futuro: oferta ativa hoje, pausada, não serve depois', () => {
    const o = oferta({})
    expect(pausaInvalidaUso(o, AGORA)).toBe(false)
    expect(pausaInvalidaUso({ ...o, active: false }, AGORA)).toBe(true)
  })

  it('escolhe a oferta com vigência mais restrita quando há empate (mais específica)', () => {
    const ampla = oferta({ vigencia_inicio: '2026-01-01', vigencia_fim: '2027-12-31' })
    const restrita = oferta({ vigencia_inicio: '2026-10-01', vigencia_fim: '2026-12-31', price_final: '17.00' })
    const r = consultarOferta([ampla, restrita], { examKey: 'HBHUMA', perfil: 'particular', unitId: 'U1', agora: AGORA })
    expect(r?.preco).toBe('17.00')
  })

  it('normaliza o preço para 2 casas', () => {
    const r = consultarOferta([oferta({ price_final: '18.265824000000002' })], { examKey: 'HBHUMA', perfil: 'particular', unitId: 'U1', agora: AGORA })
    expect(r?.preco).toBe('18.27')
  })
})
