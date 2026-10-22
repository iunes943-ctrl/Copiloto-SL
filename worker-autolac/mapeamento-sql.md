# Mapeamento SQL — AutoLac (SPEC-1-003)

**Fonte:** sessão técnica de 21/10/2026 (18:30–20:06), conduzida pelo Abílio no SSMS com atendimentos de teste reais no AutoLac. Só SELECT. Nenhum dado pessoal além do atendimento de teste sintético.

**Banco:** Microsoft SQL Server · host `0754.dbserver.autolac.com.br`, porta 754, banco `AUTOLAC` (topologia do contrato §5).

## 1. Tabelas-chave (844 tabelas mapeadas; só as relevantes)

| Papel | Tabela | Linhas | Chave/tipo |
|---|---|---|---|
| Ficha/atendimento | `SOLICITACAO` | 1.456.462 | `ID` int (monotônico), `PROTOCOLO` int + `LOCAL` nchar + `DATA` date |
| Exames da ficha | `SOLICITACAO_EXAMES` | 8.971.999 | FK `SOLICITACAO_ID` → SOLICITACAO.ID |
| Paciente | `PACIENTE` | 238.793 | `ID` int — **não monotônico no tempo** |
| Convênio | `CONVENIO` | 221 | `IDENTIFICACAO` (nvarchar) |
| Unidade coletora | `LOCAL` | 21 | `ID` nchar (SL, PM, SM…) — `SOLICITACAO.LOCAL` |
| Pagamentos | `SOLICITACAO_PAGAMENTOS` | 561.708 | — |
| Orçamento | `ORCAMENTO` + `ITEM_ORCAMENTO` | 138.826 + 1.532.610 | `SOLICITACAO.ORCAMENTO` liga |
| SUS por exame | `SOLICITACAO_EXAMES.SERVICO_SUS` / `CLASSIFICACAO_SUS` | — | base p/ meta T4 |

## 2. Vínculos (joins provados)

- `SOLICITACAO.PACIENTE` → `PACIENTE.ID`
- `SOLICITACAO_EXAMES.SOLICITACAO_ID` → `SOLICITACAO.ID`
- `PACIENTE.CONVENIO` / `PACIENTE.PLANO` → `CONVENIO.IDENTIFICACAO` (convênio NÃO fica na ficha)
- `SOLICITACAO.LOCAL` → `LOCAL.ID` (unidade coletora; protocolo exibido = LOCAL+PROTOCOLO, ex. "SL298802")
- `SOLICITACAO.ORCAMENTO` → `ORCAMENTO.ID`

## 3. Sinal de gravação e alteração (provas da sessão)

| Pergunta | Resposta | Prova |
|---|---|---|
| Ficha existe antes de salvar? | **Não** — nasce no salvar | max(ID) parado durante digitação; ficha do teste nasceu só no salvar |
| Paciente existe antes de salvar? | **Não** | idem; paciente novo apareceu só após salvar |
| Reabrir muda o banco? | **Não** | ficha e itens idênticos após fechar/reabrir; sem flag de reabertura |
| Atraso salvar→consultável? | **~zero** | salvo 20:03, visível 20:04:23 — commit imediato |
| Excluir apaga ou marca? | **Apaga** — exclusão física | fichas de teste sumiram do banco (0 linhas) |

**Consequências para o cursor:**
- Novas fichas: observação de INSERT em `SOLICITACAO` (ID crescente, monotônico) — o cursor usa `ID`.
- Edição de ficha existente: não há timestamp de alteração confiável em `SOLICITACAO` (`HORARIO` é hora de **abertura**, não do salvar). O ciclo reconsulta as fichas dos pacientes com sessão aberta por ciclo (RN-11) e o `content_hash` deduplica retratos idênticos.
- `PACIENTE.ID` **não é sequência de tempo** (paciente novo de hoje = 1.578.634; max = 3.000.060 de 2020). Nunca usar MAX(ID) de paciente; casar pela FK da ficha ou por CPF/nome+nascimento.

## 4. Campos de estado por exame

- `SOLICITACAO_EXAMES.SITUACAO`: 'P' = pendente (coletado, aguardando laudo)
- `DATACOLETA`/`HORACOLETA`/`USUARIO_COLETA`: carimbados no salvar da ficha
- `DATA_HORA_DIG`/`USUARIO_DIGITACAO`: NULL até a digitação do resultado (marcador da fase de laudo)
- `FLAG_CONFERENCIA`/`USUARIO_CONFERENCIA`: conferência
- `SERVICO_SUS`/`CLASSIFICACAO_SUS`: marcação SUS por exame (base do indicador "exames fora do SUS" da meta T4)

## 5. Perfil do atendimento

- `PACIENTE.CONVENIO` NULL/'' → perfil **particular**
- `PACIENTE.CONVENIO` preenchido → perfil **plano** (convênio)
- SUS: via `SERVICO_SUS`/`CLASSIFICACAO_SUS` por exame (a confirmar valores com o fornecedor na ativação real)

## 6. Consultas do worker (só leitura)

```sql
-- Fichas do paciente na unidade, desde o cursor (cabeçalho + itens num único SELECT)
SELECT s.ID AS ficha_id, s.PROTOCOLO, s.LOCAL, s.PACIENTE AS paciente_id,
       p.CONVENIO, p.PLANO, s.TOTAL,
       e.EXAME, e.SITUACAO, e.ORDEM
FROM SOLICITACAO s
JOIN SOLICITACAO_EXAMES e ON e.SOLICITACAO_ID = s.ID
JOIN PACIENTE p ON p.ID = s.PACIENTE
WHERE s.PACIENTE = @paciente AND s.LOCAL = @local AND s.ID > @cursor
ORDER BY s.ID, e.ORDEM;
```

Parâmetros sempre parametrizados (`@paciente`, `@local`, `@cursor`) — nunca concatenação. Nenhuma escrita: guarda `assertReadOnly` no worker recusa qualquer verbo de escrita antes de ir ao banco.

## 7. Consultas que o Abílio já usa

- Extração manual de CSV pelo próprio AutoLac (CALL 07:45–10:35) — será substituída pela leitura do worker.

## 8. Réplica para relatórios

Não identificada na sessão. O banco consultado é o operacional — intervalo de leitura deve ser conservador (definir com o Abílio; M5).

## 9. Registros de teste da sessão (encerrados)

- Fichas SL 298802 (ID 1.477.558) e SL 298807 (ID 1.477.559) — **excluídas pelo Abílio** (exclusão física confirmada).
- Paciente "TESTE SQL" (ID 1.578.634) — **marcado inativo pelo Abílio** no cadastro do AutoLac.

## 10. Pendências de ativação real

1. ~~Ambiente do worker (M5)~~ — **decidido 21/10: Render Background Worker** (porta 754 aberta ao público; Node 20 puro; ~US$7/mês).
2. ~~Usuário SQL só leitura~~ — **login `abilio` provado só-leitura (db_datareader)**; como credencial TEMPORÁRIA de prova. Usuário dedicado `integracao_sl` permanece o alvo permanente (e-mail ao fornecedor).
3. `AUTOLAC_INGEST_TOKEN` no cofre do Skip e no worker.
4. Valores de `SERVICO_SUS`/`CLASSIFICACAO_SUS` confirmados com o fornecedor.
5. Intervalo de leitura (`AUTOLAC_POLL_INTERVAL_S`) aprovado pelo Abílio após medição de carga.