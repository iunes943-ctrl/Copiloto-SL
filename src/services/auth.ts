// Autenticação do balcão (SPEC-1-001). O `pb` fica só na camada de services.
import pb from '@/lib/pocketbase/client'

export interface CurrentUser {
  id: string
  name: string
  email: string
}

export const isAuthenticated = (): boolean => pb.authStore.isValid

export const getCurrentUser = (): CurrentUser | null => {
  if (!pb.authStore.isValid) return null
  const record = pb.authStore.record
  return {
    id: record?.id ?? '',
    name: (record?.name as string | undefined) ?? '',
    email: (record?.email as string | undefined) ?? '',
  }
}

export const signIn = async (email: string, password: string): Promise<void> => {
  await pb.collection('users').authWithPassword(email, password)
}

export const signOut = (): void => {
  pb.authStore.clear()
}
