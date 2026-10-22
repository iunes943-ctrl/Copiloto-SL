# worker-autolac

Processo Node que lê o Microsoft SQL Server do AutoLac (**somente leitura**) e envia retratos das fichas gravadas para a rota `POST /backend/v1/autolac/ingest` do Copiloto São Luiz (Skip). Existe porque o backend do Skip Cloud (PocketBase em goja) não abre conexão SQL e o cron dele acorda no máximo a cada 10 minutos.

**Este diretório é espelho de deploy** — origem canônica: `07-sistemas/worker-autolac/` no repo `drkgod/sao-luiz-adapta-cliente`. Alterações de código acontecem lá e são espelhadas aqui para o Render fazer deploy (o Render está conectado a este repositório).

## Status

**Task 1 da SPEC-1-003 (prova-sql) — construído, aguardando ambiente (M5 = Render) e aceite do Abílio.**

- Mapeamento SQL provado na sessão técnica de 21/10/2026 com o Abílio: `mapeamento-sql.md`.
- Worker com TDD: testes C1/C2/C3 verdes (8/8), typecheck e build limpos.
- Porta 754 do SQL provada aberta ao público (21/10, nc via 4G + check-host.net) — sem allowlist de IP.
- Login `abilio` provado: conecta de fora, `db_datareader` (leitor=1, escritor=0, ddl=0).
- `AUTOLAC_SQL_TRUST_CERT` — se o SQL do fornecedor usar certificado próprio (comum em SQL Server self-hosted), `=true`; a conexão segue criptografada, só não valida a cadeia do certificado.

## Estrutura

- `src/sql.ts` — cliente só-leitura com guarda `assegurarSomenteLeitura` (recusa INSERT/UPDATE/DELETE/EXEC/DDL), verificação de estrutura contra o mapeamento (RN-13), pool com timeout 10s e retries limitados.
- `src/ciclo.ts` — ciclo: sessões abertas → leitura incremental desde o cursor → retratos → ingest. Cursor avança só após 2xx.
- `src/main.ts` — entrada de produção (recusa iniciar sem segredos; SELECT 1 + verificação de estrutura antes do loop).
- `src/cursor.ts` — tipos e regras do cursor (nunca rebaixa; avança para o máximo confirmado).
- `src/adaptador.ts` — normalização das linhas SQL → retratos (perfil particular/plano pelo convênio do paciente).
- `src/sessoes.ts` / `src/ingest.ts` — clientes das rotas autenticadas do Skip.
- `tests/acceptance/leitura-ficha-autolac.test.ts` — C1/C2/C3 da SPEC.

## Provas do mapeamento (21/10/2026)

- Ficha e paciente nascem no salvar (nada é gravado durante a digitação).
- Reabrir não muda o banco; exclusão é física.
- Atraso salvar→consultável ~zero (commit imediato).
- `SOLICITACAO.HORARIO` é hora de abertura, não do salvar — o sinal de gravação é o INSERT (ID monotônico).
- `PACIENTE.ID` não é sequência de tempo — nunca usar MAX(ID); casar pela FK da ficha ou CPF.

## Comandos

```bash
npm install
npm run test:run   # vitest
npm run typecheck  # tsc --noEmit
npm run build      # tsc → dist/
npm start          # node dist/main.js (requer segredos no ambiente)
```

## Segredos (nunca versionados)

`SKIP_BACKEND_URL`, `AUTOLAC_SQL_HOST/PORT/DATABASE/USER/PASSWORD/ENCRYPT/TRUST_CERT`, `AUTOLAC_INGEST_TOKEN`, `AUTOLAC_POLL_INTERVAL_S` — colados no painel do Render (Environment), nunca no repositório.

**Regra de ouro:** nunca escrever no banco do AutoLac; nunca versionar `.env`.