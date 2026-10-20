// Seleção da unidade autorizada (SPEC-1-001/C2): lista só vínculos ativos;
// a troca é registrada na auditoria antes de iniciar a sessão do balcão.
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'

const SelectUnitPage = () => {
  const { authenticated, memberships, activeUnit, selectUnit } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const [selecionando, setSelecionando] = useState<string | null>(null)

  if (!authenticated) return <Navigate to="/login" replace />
  if (activeUnit) return <Navigate to="/" replace />

  const unidades = memberships.filter((m) => m.active)

  const escolher = async (unitId: string) => {
    setErro(null)
    setSelecionando(unitId)
    try {
      await selectUnit(unitId)
      navigate('/')
    } catch {
      setErro(
        'Não foi possível registrar a troca de unidade. Verifique sua conexão e tente novamente.',
      )
      setSelecionando(null)
    }
  }

  return (
    <div className="container mx-auto py-10 px-4 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Escolher a unidade</CardTitle>
          <CardDescription>
            Selecione a unidade onde você está atendendo agora. Ela fica ativa até
            você trocar ou sair.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {unidades.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma unidade vinculada à sua conta. Procure o administrador para
              receber o acesso.
            </p>
          )}
          {unidades.map((m) => (
            <Button
              key={m.id}
              variant="outline"
              className="w-full justify-between"
              disabled={selecionando !== null}
              onClick={() => void escolher(m.unit_id)}
            >
              <span>{m.unit_name}</span>
              <span className="text-xs text-muted-foreground">
                {selecionando === m.unit_id ? 'Entrando…' : 'Selecionar'}
              </span>
            </Button>
          ))}
          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SelectUnitPage
