# Copiloto São Luiz — plataforma de construção

- plataforma: Skip
- projeto_id: 62996
- url_producao: https://copiloto-atendimento-sl-75b11.goskip.app
- url_preview: https://copiloto-atendimento-sl-75b11--preview.goskip.app
- versao_aplicada: 18e5d91 (v0.0.4)
- versao_publicada: 18e5d91 em 2026-10-20T13:46:15Z
- ultima_task: a84fa22d-4c0d-4728-9027-b7301fc52209 (Disponibilizar o acesso individual ao balcão)
- espelho: este repositório É o código sincronizado do Skip (submódulo `07-sistemas/copiloto-sl`
  do repositório do cliente). Não há pasta `codigo/` duplicada — ler o código direto daqui ou do
  projeto Skip. A fonte executável é o projeto Skip (MCP); alterações chegam por apply/publish.
  Nunca edite arquivos daqui para mudar o sistema fora de uma task.

## Histórico de entregas

| Data | Task | Versão publicada | Arquivos alterados |
|---|---|---|---|
| 20/10/2026 | — (configuração) | nenhuma | — |
| 20/10/2026 | a84fa22d (acesso individual ao balcão) | 18e5d91 | migrações 0001–0003, hooks (conta inativa, auditoria de troca), services (auth, memberships, auditoria, session), telas (Login, Unidade, Index), App.tsx, Vitest (config, setup, teste C2), package.json |

## Notas de configuração

- Repositório operacional do cliente: `drkgod/sao-luiz-adapta-cliente` (privado; este repo entra
  nele como submódulo em `07-sistemas/copiloto-sl`). O ponteiro do submódulo no repo do cliente
  pode ficar atrás do `main` daqui; a fonte da verdade do código é o projeto Skip e o `main`
  deste repositório.
- Champion dos testes e aprovações: Abílio.
- Runner de testes: Vitest instalado na task a84fa22d (scripts `test`/`test:run`/`test:watch`).
  O lockfile (pnpm-lock.yaml) é mantido pela sincronização da plataforma Skip.
