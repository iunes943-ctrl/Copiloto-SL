// Contexto de autenticação e unidade ativa do balcão (SPEC-1-001/C2 e C1).
// A sessão do balcão só existe com usuário autenticado + unidade autorizada
// escolhida; troca/logout remove o contexto anterior. A autorização é conferida
// pela guarda canUseUnit contra os vínculos do usuário, nunca por valor solto.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  isAuthenticated as serviceIsAuthenticated,
  getCurrentUser,
  signIn as serviceSignIn,
  signOut as serviceSignOut,
  type CurrentUser,
} from '@/services/auth'
import { fetchMyMemberships } from '@/services/membershipsApi'
import { registrarTrocaUnidade } from '@/services/auditoria'
import {
  resolveActiveUnit,
  chooseUnit,
  clearActiveUnit,
  canUseUnit,
  type MembershipView,
} from '@/services/memberships'

interface AuthContextValue {
  user: CurrentUser | null
  authenticated: boolean
  memberships: MembershipView[]
  activeUnit: MembershipView | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  selectUnit: (unitId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [memberships, setMemberships] = useState<MembershipView[]>([])
  const [activeUnit, setActiveUnit] = useState<MembershipView | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      if (!serviceIsAuthenticated()) {
        if (!cancelled) setLoading(false)
        return
      }
      setUser(getCurrentUser())
      setAuthenticated(true)
      try {
        const list = await fetchMyMemberships()
        if (!cancelled) {
          setMemberships(list)
          setActiveUnit(resolveActiveUnit(list))
        }
      } catch {
        // Falha de leitura: sem dado em estado; as telas pedem novo acesso.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    await serviceSignIn(email, password)
    setUser(getCurrentUser())
    setAuthenticated(true)
    const list = await fetchMyMemberships()
    setMemberships(list)
    setActiveUnit(resolveActiveUnit(list))
  }

  const signOut = () => {
    serviceSignOut()
    clearActiveUnit()
    setUser(null)
    setAuthenticated(false)
    setMemberships([])
    setActiveUnit(null)
  }

  const selectUnit = async (unitId: string) => {
    // C1: a autorização é conferida pela guarda canUseUnit contra os vínculos do usuário.
    if (!canUseUnit(memberships, unitId)) {
      throw new Error('Unidade não autorizada para este usuário.')
    }
    // Auditoria da mudança de escopo: o servidor confere o vínculo e grava o
    // evento. Falha aqui mantém a tela e mostra o erro — sem troca não auditada.
    await registrarTrocaUnidade(unitId)
    chooseUnit(unitId)
    setActiveUnit(memberships.find((m) => m.active && m.unit_id === unitId) ?? null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        authenticated,
        memberships,
        activeUnit,
        loading,
        signIn,
        signOut,
        selectUnit,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
