// Consulta de oferta no balcão (SPEC-1-002/C3): código + perfil, resposta
// com preço aplicável ou estado vazio claro. A regra (ativa, vigência,
// unidade) é do servidor — a tela só consulta e mostra.
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'

interface RespostaOferta {
  exam_key: string
  description: string
  argumento: string
  preco: string
  origem_preco: string
}

const moeda = (raw: string): string => {
  const n = Number(raw)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

const ConsultaPage = () => {
  const { authenticated, activeUnit, loading: authLoading } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [perfil, setPerfil] = useState('particular')
  const [resultado, setResultado] = useState<RespostaOferta | null>(null)
  const [buscou, setBuscou] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  if (authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (!authenticated) return <Navigate to="/login" replace />
  if (!activeUnit) return <Navigate to="/unidade" replace />

  const consultar = async () => {
    const key = codigo.trim().toUpperCase()
    if (!key) {
      setErro('Informe o código do exame.')
      return
    }
    setCarregando(true)
    setErro('')
    setResultado(null)
    try {
      const res = await pb.send('/backend/v1/ofertas/consultar', {
        method: 'POST',
        body: { exam_key: key, perfil, unit_id: activeUnit.unit_id },
      })
      const data = res as { oferta?: RespostaOferta | null }
      setResultado(data.oferta ?? null)
      setBuscou(true)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { message?: string } }).response?.message
        : undefined
      setErro(msg ?? 'Não foi possível consultar. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Consultar oferta</h1>
          <p className="text-muted-foreground">
            Preço e argumento aprovados para {activeUnit.unit_name}.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">Voltar ao balcão</Link>
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="py-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="codigo-exame">Código do exame</Label>
            <Input
              id="codigo-exame"
              placeholder="Ex.: HBHUMA"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void consultar()
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Perfil de preço</Label>
            <Select value={perfil} onValueChange={setPerfil}>
              <SelectTrigger aria-label="Perfil de preço">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="particular">Particular</SelectItem>
                <SelectItem value="plano">Plano / convênio</SelectItem>
                <SelectItem value="SUS">SUS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void consultar()} disabled={carregando}>
            {carregando ? 'Consultando…' : 'Consultar'}
          </Button>
          {erro && (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          )}
        </CardContent>
      </Card>

      {buscou && !carregando && !resultado && !erro && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma oferta ativa para este exame neste perfil e nesta unidade.
          </CardContent>
        </Card>
      )}

      {resultado && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>{resultado.description}</CardTitle>
                <CardDescription>{resultado.exam_key}</CardDescription>
              </div>
              <Badge>
                {moeda(resultado.preco)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{resultado.argumento}</p>
            <p className="text-xs text-muted-foreground">
              Preço {resultado.origem_preco === 'final' ? 'aprovado' : 'de referência'} · válido hoje · {activeUnit.unit_name}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ConsultaPage
