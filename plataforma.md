# Copiloto São Luiz — plataforma de construção

- plataforma: Skip
- projeto_id: 62996
- url_producao: https://copiloto-atendimento-sl-75b11.goskip.app
- url_preview: https://copiloto-atendimento-sl-75b11--preview.goskip.app
- versao_aplicada: e8adf0e (v0.0.3)
- versao_publicada: nenhuma em produção; preview no ar com e8adf0e (última build de desenvolvimento)
- ultima_task: nenhuma (configuração em 20/10/2026, antes da primeira task)
- espelho: este repositório É o código sincronizado do Skip (submódulo `07-sistemas/copiloto-sl`
  do repositório do cliente). Não há pasta `codigo/` duplicada — ler o código direto daqui ou do
  projeto Skip. A fonte executável é o projeto Skip (MCP); alterações chegam por apply/publish.
  Nunca edite arquivos daqui para mudar o sistema fora de uma task.

## Histórico de entregas

| Data | Task | Versão publicada | Arquivos alterados |
|---|---|---|---|
| 20/10/2026 | — (configuração) | nenhuma | — |

## Notas de configuração

- Repositório operacional do cliente: `drkgod/sao-luiz-adapta-cliente` (privado; este repo entra
  nele como submódulo em `07-sistemas/copiloto-sl`). O ponteiro do submódulo no repo do cliente
  pode ficar atrás do `main` daqui; a fonte da verdade do código é o projeto Skip e o `main`
  deste repositório.
- Champion dos testes e aprovações: Abílio.
- Projeto ainda sem runner de testes: a primeira task adiciona Vitest e os scripts
  `test`/`test:run` (ver `04_fase-atual/specs/00-CONTRATO-TECNICO.md` no repo do cliente).