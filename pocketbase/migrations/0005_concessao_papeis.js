// SPEC-1-001/C3 — papéis administrativos só por concessão explícita e auditada.
// users: ninguém se auto-registra (createRule fechado); ninguém apaga conta;
// o próprio usuário não muda o próprio 'active' nem os 'role_grants' — quem
// altera é o backend, pela rota única de concessão, sempre com auditoria.
// audit_events: campo 'detail' para registrar o conteúdo da concessão.
// memberships: mantém as regras self-only de leitura e create/update/delete
// fechados (migração 0004) — concessão de papel NUNCA passa pela API do cliente.
// ATENÇÃO (lição 0007): regra vazia ('') NÃO fecha nesta versão do PocketBase —
// aqui os campos de escrita continuam com '' por serem reafirmações; o fechamento
// real (null) foi feito na migração 0007, que é a prova de integridade.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.createRule = ''
    users.deleteRule = ''
    users.updateRule = "@request.auth.id != '' && id = @request.auth.id && @request.body.active:isset = false && @request.body.role_grants:isset = false"
    if (!users.fields.getByName('role_grants')) {
      users.fields.add(
        new SelectField({
          name: 'role_grants',
          values: ['attendant', 'leader', 'manager', 'director', 'admin', 'curator_technical', 'curator_commercial'],
          maxSelect: 6,
          required: false,
          presentable: false,
        }),
      )
    }
    app.save(users)

    const audit = app.findCollectionByNameOrId('audit_events')
    if (!audit.fields.getByName('detail')) {
      audit.fields.add(
        new TextField({
          name: 'detail',
          max: 500,
          required: false,
          presentable: false,
        }),
      )
    }
    app.save(audit)

    const memberships = app.findCollectionByNameOrId('memberships')
    memberships.listRule = "@request.auth.id != '' && user_id = @request.auth.id"
    memberships.viewRule = "@request.auth.id != '' && user_id = @request.auth.id"
    memberships.createRule = ''
    memberships.updateRule = ''
    memberships.deleteRule = ''
    app.save(memberships)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.createRule = ''
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'
    if (users.fields.getByName('role_grants')) {
      users.fields.removeByName('role_grants')
    }
    app.save(users)

    const audit = app.findCollectionByNameOrId('audit_events')
    if (audit.fields.getByName('detail')) {
      audit.fields.removeByName('detail')
    }
    app.save(audit)
  },
)
