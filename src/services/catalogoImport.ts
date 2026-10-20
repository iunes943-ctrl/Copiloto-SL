// Importação do catálogo com conferência (SPEC-1-002/C1).
// Normalização: trim + upper, preservando o raw. Conflito de chave
// normalizada com preços diferentes é sinalizado — nunca resolvido
// automaticamente. Nada sai aprovado/ativo pela importação.
export interface LinhaCatalogo {
  source_row: number
  code_raw: string
  description: string
  price_raw_decimal: string
  currency?: string
}

export interface LinhaAnalise extends LinhaCatalogo {
  code_normalized: string
  conflict: boolean
  price_approved: boolean
  active: boolean
  batch_scope: string
}

export interface ResultadoAnalise {
  total: number
  validas: number
  conflitos: { chave: string; linhas: number[] }[]
  linhas: LinhaAnalise[]
}

export const normalizarCodigo = (raw: string): string => raw.trim().toUpperCase()

export const analisarImportacao = (rows: LinhaCatalogo[]): ResultadoAnalise => {
  const porChave = new Map<string, { preco: number; linhas: number[] }>()
  for (const r of rows) {
    const chave = normalizarCodigo(r.code_raw)
    const preco = Number(r.price_raw_decimal)
    const atual = porChave.get(chave)
    if (!atual) {
      porChave.set(chave, { preco, linhas: [r.source_row] })
    } else {
      // Mesma chave: conflito quando o preço difere (tolerância decimal).
      if (Math.abs(atual.preco - preco) > 1e-9) {
        atual.preco = NaN // marca divergência
      }
      atual.linhas.push(r.source_row)
    }
  }

  const chavesConflitantes = new Set(
    [...porChave.entries()].filter(([, v]) => Number.isNaN(v.preco)).map(([k]) => k),
  )

  const linhas: LinhaAnalise[] = rows.map((r) => ({
    ...r,
    code_normalized: normalizarCodigo(r.code_raw),
    conflict: chavesConflitantes.has(normalizarCodigo(r.code_raw)),
    price_approved: false,
    active: false,
    batch_scope: 'lote',
  }))

  return {
    total: rows.length,
    validas: rows.length,
    conflitos: [...chavesConflitantes].map((chave) => ({
      chave,
      linhas: porChave.get(chave)?.linhas ?? [],
    })),
    linhas,
  }
}
