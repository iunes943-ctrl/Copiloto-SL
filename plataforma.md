# Copiloto São Luiz — plataforma de construção

- plataforma: Skip
- projeto_id: 62996
- url_producao: https://copiloto-atendimento-sl-75b11.goskip.app
- url_preview: https://copiloto-atendimento-sl-75b11--preview.goskip.app
- versao_aplicada: 8a25a3d (v0.0.5)
- versao_publicada: 8a25a3d em 2026-10-20T14:00:09Z
- ultima_task: d4f85c36-8618-4fd1-8f08-5638eace87b4 (Restringir os dados de cada unidade)
- espelho: este repositório É o código sincronizado of Skip (submódulo `07-sistemas/copiloto-sl`
  do repositório do cliente). Não há pasta `codigo/` duplicada — ler o código direto daqui ou do
  projeto Skip. A fonte executável é o projeto Skip (MCP); alterações chegam por apply/publish.
  Nunca edite arquivos daqui para mudar o sistema fora de uma task.

## Histórico de entregas

| Data | Task | Versão publicada | Arquivos alterados |
|---|---|---|---|
| 20/10/2026 | — (configuração) | nenhuma | — |
| 20/10/2026 | a84fa22d (acesso individual ao balcão) | 18e5d91 | migrações 0001–0003, hooks (conta inativa, auditoria de troca), services (auth, memberships, auditoria, session), telas (Login, Unidade, Index), App.tsx, Vitest 12/12 (C2+C1) |
| 20/10/2026 | d4f85c36 (restringir dados por unidade) | 8a25a3d | migração 0004 (endurecimento de regras), guarda canUseUnit no AuthContext, testes C1+C2 |

## Notas de configuração

- Repositório operacional do cliente: `drkgod/sao-luiz-adapta-cliente` (privado; este repo entra
  nele como submódulo em `07-sistemas/copiloto-sl`). O ponteiro do submódulo no repo do cliente
  pode ficar atrás do `main` daqui; a fonte da verdade do código é o projeto Skip e o `main`
  deste repositório.
- Champion dos testes e aprovações: Abílio.
- Runner de testes: Vitest instalado na task a84fa22d (scripts `test`/`test:run`/`test:watch`).
  O lockfile (pnpm-lock.yaml) é mantido pela sincronização da plataforma Skip.
