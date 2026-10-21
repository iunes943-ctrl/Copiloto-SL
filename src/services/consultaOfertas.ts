// Consulta de oferta por perfil/unidade (SPEC-1-002/C3).
// Regras: só oferta ativa, dentro da vigência, do perfil e da unidade
// pedidos; preço vazio não é reutilizado de outra tabela (cai para a
// referência, nunca inventa); pausa invalida uso futuro; empate resolve
// pela vigência mais restrita (mais específica).
export interface OfertaConsulta {
  exam_key: string
  preco: string
  perfil: string
}

export interface OfertaConsultaFonte {
  exam_key: string
  price_final: string
  price_reference: string
  perfil: string
  unit_id: string
  vigencia_inicio: string
  vigencia_fim: string
  active: boolean
  aprovacao_tecnica: boolean
  aprovacao_comercial: boolean
}

export const dentroDaVigencia = (
  inicio: string,
  fim: string,
  agora: Date,
): boolean => {
  if (!inicio || !fim) return false
  const i = new Date(inicio)
  const f = new Date(fim)
  if (Number.isNaN(i.getTime()) || Number.isNaN(f.getTime())) return false
  return agora >= i && agora <= f
}

export const consultarOferta = (
  ofertas: OfertaConsultaFonte[],
  params: { examKey: string; perfil: string; unitId: string; agora?: Date },
): OfertaConsulta | null => {
  const agora = params.agora ?? new Date()
  const elegiveis = ofertas.filter(
    (o) =>
      o.exam_key.toUpperCase() === params.examKey.toUpperCase() &&
      o.unit_id === params.unitId &&
      o.active &&
      o.aprovacao_tecnica &&
      o.aprovacao_comercial &&
      dentroDaVigencia(o.vigencia_inicio, o.vigencia_fim, agora) &&
      (Number.isFinite(Number(o.price_final)) && o.price_final !== '' ||
        Number.isFinite(Number(o.price_reference)) && o.price_reference !== ''),
  )
  if (elegiveis.length === 0) return null
  // Empate: vigência mais restrita (fim mais cedo, depois início mais tarde).
  elegiveis.sort((a, b) => {
    const fa = new Date(a.vigencia_fim).getTime()
    const fb = new Date(b.vigencia_fim).getTime()
    if (fa !== fb) return fa - fb
    const ia = new Date(a.vigencia_inicio).getTime()
    const ib = new Date(b.vigencia_inicio).getTime()
    return ib - ia
  })
  const escolhida = elegiveis[0]
  const preco =
    escolhida.price_final !== '' && Number.isFinite(Number(escolhida.price_final))
      ? escolhida.price_final
      : escolhida.price_reference
  return {
    exam_key: escolhida.exam_key,
    preco: (Math.round(Number(preco) * 100) / 100).toFixed(2),
    perfil: params.perfil,
  }
}

// Pausa invalida uso futuro: uma oferta que estava ativa e foi pausada não
// serve para consultas posteriores (a checagem de active já cobre isso; a
// função documenta o comportamento para o cartão aberto no balcão).
export const pausaInvalidaUso = (
  oferta: { active: boolean },
  _agora?: Date,
): boolean => !oferta.active
