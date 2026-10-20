import { describe, it, expect } from 'vitest'
import { normalizarCodigo, analisarImportacao, type LinhaCatalogo } from '@/services/catalogoImport'

// Massa SINTÉTICA (SPEC-1-002): espelha a estrutura do insumo real
// (01_insumos/catalogo-exames.json) sem copiar dados comerciais para o teste.
const linha = (source_row: number, code_raw: string, description: string, price: string): LinhaCatalogo => ({
  source_row,
  code_raw,
  description,
  price_raw_decimal: price,
  currency: 'BRL',
})

describe('SPEC-1-002 / C1 — importação reproduz a origem e sinaliza conflito de chave normalizada', () => {
  it('normaliza código com trim + upper preservando o raw', () => {
    expect(normalizarCodigo(' CITO SOL')).toBe('CITO SOL')
    expect(normalizarCodigo('cito sol')).toBe('CITO SOL')
  })

  it('reproduz a contagem total das linhas de origem', () => {
    const rows = [linha(2, 'A', 'Exame A', '10.00'), linha(3, 'B', 'Exame B', '20.00')]
    const r = analisarImportacao(rows) as { total: number; validas: number }
    expect(r.total).toBe(2)
    expect(r.validas).toBe(2)
  })

  it('sinaliza exatamente 1 chave normalizada conflitante (2 linhas, preços diferentes)', () => {
    const rows = [
      linha(107, ' CITO SOL', 'Exame X (variação 1)', '482.55'),
      linha(108, 'CITO SOL', 'Exame X (variação 2)', '483.02'),
      linha(109, 'OUTRO', 'Exame Y', '91.32'),
    ]
    const r = analisarImportacao(rows) as { conflitos: { chave: string; linhas: number[] }[] }
    expect(r.conflitos).toHaveLength(1)
    expect(r.conflitos[0].chave).toBe('CITO SOL')
    expect(r.conflitos[0].linhas).toEqual([107, 108])
  })

  it('não escolhe automaticamente entre valores diferentes: ambas as linhas ficam marcadas, nenhuma aprovada/ativa', () => {
    const rows = [
      linha(107, ' CITO SOL', 'Exame X (variação 1)', '482.55'),
      linha(108, 'CITO SOL', 'Exame X (variação 2)', '483.02'),
    ]
    const r = analisarImportacao(rows) as { linhas: { conflict: boolean; price_approved: boolean; active: boolean; code_raw: string }[] }
    const conflitantes = r.linhas.filter((l) => l.conflict)
    expect(conflitantes).toHaveLength(2)
    expect(conflitantes.map((l) => l.code_raw).sort()).toEqual([' CITO SOL', 'CITO SOL'])
    expect(conflitantes.every((l) => !l.price_approved && !l.active)).toBe(true)
  })

  it('importação parcial não altera linhas de lote anterior (linhas novas carregam o próprio lote)', () => {
    const rows = [linha(2, 'A', 'Exame A', '10.00')]
    const r = analisarImportacao(rows) as { linhas: { batch_scope: string }[] }
    expect(r.linhas.every((l) => l.batch_scope === 'lote')).toBe(true)
  })
})
