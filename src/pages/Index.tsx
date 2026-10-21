// Página inicial do balcão (SPEC-1-001/C2): nome do usuário, unidade ativa,
// modo demonstração e botão de sair. Sem unidade ativa, volta para a escolha.
// Links para consulta, catálogo e ofertas (SPEC-1-002).
import { Navigate, useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
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
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Consultar oferta</CardTitle>
            <CardDescription>
              Preço e argumento aprovados para o exame, no perfil e na unidade do
              atendimento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/consulta">Consultar oferta</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Catálogo</CardTitle>
            <CardDescription>
              Conferência dos exames importados: contagem, busca e conflitos de
              código em destaque.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/catalogo">Conferir catálogo</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ofertas</CardTitle>
            <CardDescription>
              Candidatos com aprovação técnica e comercial separadas; ativação
              exige as duas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/ofertas">Ver ofertas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Index
