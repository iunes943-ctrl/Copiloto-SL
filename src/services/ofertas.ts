// Candidatos de oferta e alçadas (SPEC-1-002/C2).
// Nenhum candidato fica ativo sem as DUAS aprovações (técnica e comercial)
// e escopo válido (tabela ativa dentro da vigência; regra com vigência
// definida e corrente). Pausa desativa e preserva aprovações (histórico).
export interface Candidato {
  aprovacao_tecnica: boolean
  aprovacao_comercial: boolean
  escopo_valido: boolean
  ativo: boolean
}

export const podeAtivar = (c: Candidato): boolean =>
  c.aprovacao_tecnica && c.aprovacao_comercial && c.escopo_valido

export const ativar = (c: Candidato): Candidato | null =>
  podeAtivar(c) ? { ...c, ativo: true } : null

export const pausar = (c: Candidato): Candidato => ({ ...c, ativo: false })

export const escopoTabelaValido = (
  t: { active: boolean; valid_from?: string; valid_to?: string },
  agora = new Date(),
): boolean => {
  if (!t.active) return false
  const inicio = t.valid_from ? new Date(t.valid_from) : null
  const fim = t.valid_to ? new Date(t.valid_to) : null
  if (inicio && agora < inicio) return false
  if (fim && agora > fim) return false
  return true
}

export const escopoRegraValido = (
  r: { vigencia_inicio?: string; vigencia_fim?: string },
  agora = new Date(),
): boolean => {
  const inicio = r.vigencia_inicio ? new Date(r.vigencia_inicio) : null
  const fim = r.vigencia_fim ? new Date(r.vigencia_fim) : null
  if (!inicio && !fim) return false
  if (inicio && agora < inicio) return false
  if (fim && agora > fim) return false
  return true
}
