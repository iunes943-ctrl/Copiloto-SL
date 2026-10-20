// Leitura do catálogo para conferência (SPEC-1-002/C1). Só leitura: escrita
// é negada pela coleção (importação auditada é a única via).
import pb from '@/lib/pocketbase/client'

export interface CatalogoItem {
  id: string
  source_row: number
  code_raw: string
  code_normalized: string
  description: string
  price_raw_decimal: string
  conflict: boolean
  active: boolean
}

export interface ResultadoBusca {
  items: CatalogoItem[]
  total: number
}

export const buscarCatalogo = async (
  page: number,
  busca: string,
  soConflitos: boolean,
): Promise<ResultadoBusca> => {
  const filtros: string[] = []
  const params: Record<string, string> = {}
  const q = busca.trim()
  if (q) {
    filtros.push('(code_normalized ~ {:q} || description ~ {:q})')
    params.q = q
  }
  if (soConflitos) filtros.push('conflict = true')
  const filter = filtros.length > 0 ? pb.filter(filtros.join(' && '), params) : ''
  const res = await pb.collection('exam_catalog').getList(page, 25, {
    filter,
    sort: 'source_row',
  })
  return {
    total: res.totalItems,
    items: res.items.map((r) => ({
      id: r.id,
      source_row: Number(r.source_row),
      code_raw: String(r.code_raw),
      code_normalized: String(r.code_normalized),
      description: String(r.description),
      price_raw_decimal: String(r.price_raw_decimal),
      conflict: Boolean(r.conflict),
      active: Boolean(r.active),
    })),
  }
}

export const formatarPrecoReferencia = (raw: string): string => {
  const n = Number(raw)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}
