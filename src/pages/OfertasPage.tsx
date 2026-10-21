// Lista e gestão de candidatos de oferta (SPEC-1-002/C2). Leitura para
// autenticados; ações (aprovar/ativar/pausar) chamam as rotas auditadas e
// o servidor confere a alçada — a tela só espelha o resultado.
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
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
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'

interface Candidato {
  id: string
  exam_key: string
  description: string
  argumento: string
  price_reference: string
  price_final: string
  table_ref: string
  vigencia_inicio: string
  vigencia_fim: string
  aprovacao_tecnica: boolean
  aprovacao_comercial: boolean
  active: boolean
}

const moeda = (raw: string): string => {
  const n = Number(raw)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

const dataBR = (iso: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

const OfertasPage = () => {
  const { authenticated, activeUnit, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<Candidato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState('')

  const carregar = async () => {
    setCarregando(true)
    setErro('')
    try {
      const res = await pb.collection('offer_candidates').getList(1, 50, { sort: '-updated' })
      setItems(res.items as unknown as Candidato[])
    } catch {
      setErro('Não foi possível carregar as ofertas. Verifique a conexão e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (authLoading || !authenticated || !activeUnit) return
    void carregar()
  }, [authLoading, authenticated, activeUnit])

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

  const acao = async (rota: string, id: string, rotulo: string) => {
    setOcupado(id)
    try {
      await pb.send(rota, { method: 'POST', body: { id } })
      toast({ title: rotulo, description: 'Registrado com auditoria.' })
      await carregar()
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { message?: string } }).response?.message
        : undefined
      toast({
        title: 'Não foi possível concluir',
        description: msg ?? 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setOcupado('')
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ofertas</h1>
          <p className="text-muted-foreground">
            Candidatos com aprovação técnica e comercial separadas; ativação exige as duas.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">Voltar ao balcão</Link>
        </Button>
      </div>

      {erro && (
        <Card className="mb-4 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Erro ao carregar</CardTitle>
            <CardDescription>{erro}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void carregar()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {carregando && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!carregando && !erro && items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum candidato de oferta ainda. A criação de candidatos acontece
            pela rota auditada (curadores/admin).
          </CardContent>
        </Card>
      )}

      {!carregando && !erro && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{c.description}</CardTitle>
                      <CardDescription>
                        {c.exam_key} · tabela {c.table_ref} · vigência {dataBR(c.vigencia_inicio)} a {dataBR(c.vigencia_fim)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.active ? (
                        <Badge>Ativa</Badge>
                      ) : c.aprovacao_tecnica && c.aprovacao_comercial ? (
                        <Badge variant="secondary">Pronta para ativar</Badge>
                      ) : (
                        <Badge variant="outline">Em aprovação</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{c.argumento}</p>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span>
                      Preço de referência: <strong>{moeda(c.price_reference)}</strong>
                    </span>
                    {c.price_final && (
                      <span>
                        Preço final: <strong>{moeda(c.price_final)}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={c.aprovacao_tecnica ? 'default' : 'outline'}>
                      {c.aprovacao_tecnica ? 'Técnica ✓' : 'Técnica pendente'}
                    </Badge>
                    <Badge variant={c.aprovacao_comercial ? 'default' : 'outline'}>
                      {c.aprovacao_comercial ? 'Comercial ✓' : 'Comercial pendente'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!c.aprovacao_tecnica && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ocupado === c.id}
                        onClick={() => void acao('/backend/v1/ofertas/aprovar-tecnica', c.id, 'Aprovação técnica registrada')}
                      >
                        Aprovar técnica
                      </Button>
                    )}
                    {!c.aprovacao_comercial && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ocupado === c.id}
                        onClick={() => void acao('/backend/v1/ofertas/aprovar-comercial', c.id, 'Aprovação comercial registrada')}
                      >
                        Aprovar comercial
                      </Button>
                    )}
                    {!c.active && c.aprovacao_tecnica && c.aprovacao_comercial && (
                      <Button
                        size="sm"
                        disabled={ocupado === c.id}
                        onClick={() => void acao('/backend/v1/ofertas/ativar', c.id, 'Oferta ativada')}
                      >
                        Ativar
                      </Button>
                    )}
                    {c.active && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={ocupado === c.id}
                        onClick={() => void acao('/backend/v1/ofertas/pausar', c.id, 'Oferta pausada')}
                      >
                        Pausar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default OfertasPage
