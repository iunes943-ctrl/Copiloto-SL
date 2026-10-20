// Auditoria de mudança de escopo (SPEC-1-001/C2): registra a troca de unidade
// na rota backend, que confere o vínculo e grava o evento com o actor da sessão.
import pb from '@/lib/pocketbase/client'

export const registrarTrocaUnidade = async (unitId: string): Promise<void> => {
  await pb.send('/backend/v1/auditoria/troca-unidade', {
    method: 'POST',
    body: { unit_id: unitId },
  })
}
