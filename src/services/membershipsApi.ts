// Acesso real ao backend: só vínculos ativos do usuário autenticado,
// com nome da unidade expandido. Erros sobem para a página tratar.
import pb from '@/lib/pocketbase/client'
import type { MembershipView } from '@/services/memberships'

export const fetchMyMemberships = async (): Promise<MembershipView[]> => {
  const userId = pb.authStore.record?.id
  if (!userId) return []
  const records = await pb.collection('memberships').getFullList({
    filter: pb.filter('user_id = {:u} && active = true', { u: userId }),
    expand: 'unit_id',
  })
  return records.map((r) => ({
    id: r.id,
    unit_id: r.unit_id,
    unit_name: (r.expand?.unit_id?.name as string | undefined) ?? r.unit_id,
    tenant_id: r.tenant_id,
    roles: (r.roles as string[] | undefined) ?? [],
    active: r.active,
  }))
}
