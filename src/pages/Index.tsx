// Página inicial do balcão (SPEC-1-001/C2): nome do usuário, unidade ativa,
// modo demonstração e botão de sair. Sem unidade ativa, volta para a escolha.
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'

const Index = () => {
  const { authenticated, activeUnit, user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (!authenticated) return <Navigate to="/login" replace />
  if (!activeUnit) return <Navigate to="/unidade" replace />

  const sair = () => {
    signOut()
    navigate('/login')
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Balcão</h1>
          <p className="text-muted-foreground">
            {user?.name} · {activeUnit.unit_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Modo demonstração</Badge>
          <Button variant="outline" onClick={sair}>
            Sair
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Atendimento</CardTitle>
          <CardDescription>
            Contexto do paciente e ofertas aparecerão aqui nas próximas etapas da
            fase 1.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Você está atendendo em <strong>{activeUnit.unit_name}</strong>. Ao trocar
            de unidade ou sair, o contexto deste atendimento é encerrado.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default Index
