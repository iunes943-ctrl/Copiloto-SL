import { describe, it, expect } from 'vitest'
import {
  podeAtivar,
  ativar,
  pausar,
  escopoTabelaValido,
  escopoRegraValido,
  type Candidato,
} from '@/services/ofertas'

const base: Candidato = {
  aprovacao_tecnica: false,
  aprovacao_comercial: false,
  escopo_valido: false,
  ativo: false,
}

describe('SPEC-1-002 / C2 — nenhum candidato fica ativo sem aprovações e escopo válidos', () => {
  it('sem aprovações não ativa', () => {
    expect(podeAtivar(base)).toBe(false)
  })
  it('só aprovação técnica não ativa', () => {
    expect(podeAtivar({ ...base, aprovacao_tecnica: true })).toBe(false)
  })
  it('só aprovação comercial não ativa', () => {
    expect(podeAtivar({ ...base, aprovacao_comercial: true })).toBe(false)
  })
  it('duas aprovações sem escopo válido não ativa', () => {
    expect(podeAtivar({ ...base, aprovacao_tecnica: true, aprovacao_comercial: true })).toBe(false)
  })
  it('duas aprovações e escopo válido ativa', () => {
    expect(
      podeAtivar({ ...base, aprovacao_tecnica: true, aprovacao_comercial: true, escopo_valido: true }),
    ).toBe(true)
  })
  it('ativar recusa candidato inválido (retorna null, nunca ativa)', () => {
    expect(ativar(base)).toBeNull()
  })
  it('pausa desativa e preserva aprovações para o histórico', () => {
    const p = pausar({ aprovacao_tecnica: true, aprovacao_comercial: true, escopo_valido: true, ativo: true })
    expect(p.ativo).toBe(false)
    expect(p.aprovacao_tecnica).toBe(true)
    expect(p.aprovacao_comercial).toBe(true)
  })
  it('tabela inativa não é escopo válido', () => {
    expect(escopoTabelaValido({ active: false })).toBe(false)
  })
  it('tabela fora da vigência não é escopo válido', () => {
    expect(escopoTabelaValido({ active: true, valid_from: '2099-01-01' })).toBe(false)
  })
  it('tabela dentro da vigência é escopo válido', () => {
    expect(escopoTabelaValido({ active: true, valid_from: '2026-01-01', valid_to: '2099-12-31' })).toBe(true)
  })
  it('regra sem vigência definida não é escopo válido', () => {
    expect(escopoRegraValido({})).toBe(false)
  })
  it('regra dentro da vigência é escopo válido', () => {
    expect(escopoRegraValido({ vigencia_inicio: '2026-01-01', vigencia_fim: '2099-12-31' })).toBe(true)
  })
})
