/**
 * adaptador.ts — normaliza linhas do SQL do AutoLac → envelope do contrato §5.
 *
 * Mapeamento real (sessão SQL 21/10/2026, provado com fichas de teste):
 * - Ficha: SOLICITACAO (ID, LOCAL, PROTOCOLO, DATA, PACIENTE, SUBTOTAL/DESCONTO/TOTAL, USUARIO_INCLUSAO)
 * - Itens: SOLICITACAO_EXAMES (FK SOLICITACAO_ID; EXAME, SITUACAO 'P'=pendente)
 * - Paciente: PACIENTE (ID não monotônico; CONVENIO/PLANO nvarchar → CONVENIO.IDENTIFICACAO)
 * - Convênio NÃO fica na ficha — perfil do atendimento resolve pelo paciente.
 * - Exclusão física: ID que sumiu = cancelada.
 */
import { createHash } from 'node:crypto'

export type LinhaFicha = {
  ID: number
  LOCAL: string
  PROTOCOLO: number
  DATA: string
  PACIENTE: number
  SUBTOTAL: number | null
  DESCONTO: number | null
  TOTAL: number | null
  USUARIO_INCLUSAO: string | null
}

export type LinhaItem = {
  ID: number
  SOLICITACAO_ID: number
  EXAME: string
  SITUACAO: string | null
  ORDEM: number | null
}

export type LinhaPaciente = {
  ID: number
  NOME: string | null
  CPF: string | null
  DATANASCIMENTO: string | null
  SEXO: string | null
  CONVENIO: string | null
  PLANO: string | null
  INATIVO: string | null
}

export type ItemNormalizado = { examCode: string; quantity: number; status: string }

export type Retrato = {
  encounterExternalId: string // ID da ficha (SOLICITACAO.ID)
  patientExternalId: string // ID do paciente (PACIENTE.ID)
  profile: 'particular' | 'plano' | 'sus'
  sourceStatus: string
  items: ItemNormalizado[]
  completeness: 'complete' | 'partial'
  contentHash: string
  observedAt: string
  session_id: string // sessão do Skip que originou a leitura — o Skip roteia por ela
}

export type Envelope = {
  source: 'autolac'
  tenantRef: string
  unitRef: string
  observedAt: string
  records: Retrato[]
  nextCursor: number | null
  completeness: 'complete' | 'partial'
}

export function perfilDoPaciente(p: Pick<LinhaPaciente, 'CONVENIO' | 'PLANO'>): 'particular' | 'plano' | 'sus' {
  // PACIENTE.CONVENIO/PLANO NULL = particular (prova: ficha de teste com CONVENIO NULL).
  // SUS: classificação vem de SOLICITACAO_EXAMES.SERVICO_SUS/CLASSIFICACAO_SUS — fase seguinte;
  // aqui o convênio nomeado decide plano vs particular.
  if (!p.CONVENIO || p.CONVENIO.trim() === '') return 'particular'
  return 'plano'
}

export function hashRetrato(retrato: {
  encounterExternalId: string
  patientExternalId: string
  profile: string
  sourceStatus: string
  items: ItemNormalizado[]
}): string {
  const conteudo = JSON.stringify({
    encounterExternalId: retrato.encounterExternalId,
    patientExternalId: retrato.patientExternalId,
    profile: retrato.profile,
    sourceStatus: retrato.sourceStatus,
    items: retrato.items,
  })
  return createHash('sha256').update(conteudo).digest('hex')
}

export function normalizarFicha(
  ficha: LinhaFicha,
  itens: LinhaItem[],
  paciente: LinhaPaciente | null,
  sessionId: string,
  agora: Date = new Date(),
): Retrato {
  const items: ItemNormalizado[] = itens.map((it) => ({
    examCode: String(it.EXAME ?? '').trim(),
    quantity: 1,
    status: (it.SITUACAO ?? 'P').trim() || 'P',
  }))
  const retratoBase = {
    encounterExternalId: String(ficha.ID),
    patientExternalId: String(ficha.PACIENTE),
    profile: perfilDoPaciente(paciente ?? { CONVENIO: null, PLANO: null }),
    sourceStatus: 'gravada',
    items,
  }
  const completeness: 'complete' | 'partial' = items.length > 0 ? 'complete' : 'partial'
  return {
    ...retratoBase,
    completeness,
    contentHash: hashRetrato(retratoBase), // hash só sobre conteúdo — session_id fora, idempotência estável
    observedAt: agora.toISOString(),
    session_id: sessionId,
  }
}