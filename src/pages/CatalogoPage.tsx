// Conferência do catálogo importado (SPEC-1-002/C1): contagem, busca e
// conflitos em destaque. Somente leitura — nada aqui aprova ou ativa.
// Exige sessão com unidade ativa (mesma guarda do balcão): sem ela, volta
// para login/unidade. Erro de leitura aparece na tela, nunca silencioso.
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import {
  buscarCatalogo,
  formatarPrecoReferencia,
  type CatalogoItem,
} from '@/services/catalogoApi'

const CatalogoPage = () => {
  const { authenticated, activeUnit, loading: authLoading } = useAuth()
  const [busca, setBusca] = useState('')
  const [buscaEfetiva, setBuscaEfetiva] = useState('')
  const [soConflitos, setSoConflitos] = useState(false)
  const [items, setItems] = useState<CatalogoItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // Debounce da busca: consulta 300 ms após parar de digitar.
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaEfetiva(busca)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    if (authLoading || !authenticated || !activeUnit) return
    let cancelled = false
    setCarregando(true)
    setErro('')
    buscarCatalogo(page, buscaEfetiva, soConflitos)
      .then((r) => {
        if (!cancelled) {
          setItems(r.items)
          setTotal(r.total)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErro('Não foi possível carregar o catálogo. Verifique a conexão e tente novamente.')
        }
      })
      .finally(() => {
        if (!cancelled) setCarregando(false)
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, authenticated, activeUnit, buscaEfetiva, soConflitos, page])

  const totalPaginas = Math.max(1, Math.ceil(total / 25))

  if (authLoading) {
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Catálogo</h1>
          <p className="text-muted-foreground">
            {carregando && !erro ? (
              'Carregando…'
            ) : (
              <>
                {total.toLocaleString('pt-BR')} exames importados · preços de
                referência, nada aprovado ainda
              </>
            )}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">Voltar ao balcão</Link>
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        <Label htmlFor="busca-catalogo">Buscar por código ou descrição</Label>
        <Input
          id="busca-catalogo"
          type="search"
          placeholder="Ex.: hemoglobina, CITO SOL…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="so-conflitos"
            checked={soConflitos}
            onCheckedChange={(v) => {
              setSoConflitos(v === true)
              setPage(1)
            }}
          />
          <Label htmlFor="so-conflitos" className="font-normal">
            Mostrar só os conflitos de código
          </Label>
        </div>
      </div>

      {erro && (
        <Card className="mb-4 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Erro ao carregar</CardTitle>
            <CardDescription>{erro}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setPage(1)}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {carregando && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!carregando && !erro && items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum exame encontrado{buscaEfetiva ? ` para “${buscaEfetiva}”` : ''}.
            Ajuste a busca ou limpe o filtro de conflitos.
          </CardContent>
        </Card>
      )}

      {!carregando && !erro && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <CardContent className="py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {item.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Código {item.code_raw} · linha {item.source_row}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <span className="font-medium whitespace-nowrap">
                        {formatarPrecoReferencia(item.price_raw_decimal)}
                      </span>
                      {item.conflict && <Badge variant="destructive">Conflito</Badge>}
                      {item.active && <Badge variant="secondary">Ativo</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!carregando && !erro && totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPaginas}
            onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}

export default CatalogoPage
