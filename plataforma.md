# Copiloto São Luiz — plataforma de construção

- plataforma: Skip
- projeto_id: 62996
- url_producao: https://copiloto-atendimento-sl-75b11.goskip.app
- url_preview: https://copiloto-atendimento-sl-75b11--preview.goskip.app
- backend: https://copiloto-atendimento-sl-75b11.shrd03.internal.goskip.dev (API PocketBase; a URL de produção serve só o front)
- versao_aplicada: 2029add (v0.0.10)
- versao_publicada: 2029add em 2026-10-20T14:36:35Z
- ultima_task: 8c6efd20-5efc-4fab-87b3-9d50e0ef5bd3 (Conferir o acesso nos computadores da matriz — C3)
- espelho: este repositório É o código sincronizado do Skip (submódulo `07-sistemas/copiloto-sl`
  do repositório do cliente). Não há pasta `codigo/` duplicada — ler o código direto daqui ou do
  projeto Skip. A fonte executável é o projeto Skip (MCP); alterações chegam por apply/publish.
  Nunca edite arquivos daqui para mudar o sistema fora de uma task.

## Histórico de entregas

| Data | Task | Versão publicada | Arquivos alterados |
|---|---|---|---|
| 20/10/2026 | — (configuração) | nenhuma | — |
| 20/10/2026 | a84fa22d (acesso individual ao balcão) | 18e5d91 | migrações 0001–0003, hooks (conta inativa, auditoria de troca), services (auth, memberships, auditoria, session), telas (Login, Unidade, Index), App.tsx, Vitest (config, setup, teste C2), package.json |
| 20/10/2026 | d4f85c36 (restringir dados por unidade) | 8a25a3d | migração 0004 (endurecimento de regras), guarda canUseUnit no AuthContext, testes C1+C2 |
| 20/10/2026 | 8c6efd20 (concessão de papéis, C3) | 2029add | services/papeis.ts (alçada), hook conceder_papel (rota única auditada), migrações 0005 (role_grants/detail), 0006 (admin demo), 0007 (CORREÇÃO CRÍTICA: regras vazias abriam escrita — null em todas as coleções), 0008 (limpeza do teste), testes 17/17 (C1+C2+C3) |

## Lições técnicas

- **Regra vazia ('') no PocketBase desta plataforma NÃO fecha acesso — abre ao público** (string
  vazia = todos; null = só superusuário/backend). Toda regra que deve negar deve ser `null`.
  Prova: teste de integridade 20/10 (criação/edição/apagão de memberships e audit_events e
  auto-registro público antes da 0007; 403 em tudo depois).
- Migrações em `pocketbase/migrations/`; para coleção existente, `fields.add` exige construtores
  tipados (`new SelectField(...)`, `new TextField(...)`), não objeto plano.
- A URL de produção serve só o front; a API PocketBase fica no host `*.shrd*.internal.goskip.dev`
  (skip_cloud_get_backend_url). Testes de API devem usar o backend, não a produção.
- `audit_events` é append-only: create/update/delete são null (só rotas backend gravam).

## Notas de configuração

- Repositório operacional do cliente: `drkgod/sao-luiz-adapta-cliente` (privado; este repo entra
  nele como submódulo em `07-sistemas/copiloto-sl`). O ponteiro do submódulo no repo do cliente
  pode ficar atrás do `main` daqui; a fonte da verdade do código é o projeto Skip e o `main`
  deste repositório.
- Champion dos testes e aprovações: Abílio.
- Runner de testes: Vitest instalado na task a84fa22d (scripts `test`/`test:run`/`test:watch`).
  O lockfile (pnpm-lock.yaml) é mantido pela sincronização da plataforma Skip.
