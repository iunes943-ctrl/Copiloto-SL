// SPEC-1-001/C1 — endurecimento do isolamento entre unidades no servidor.
// memberships: só o próprio usuário lê os próprios vínculos (já era assim);
// agora também ninguém cria/edita/apaga vínculos pela API do cliente.
// audit_events: list/view self-only por actor (já era); create/edit/delete
// continuam fechados — auditoria é append-only pela rota backend.
migrate(
  (app) => {
    const memberships = app.findCollectionByNameOrId('memberships')
    memberships.listRule = "@request.auth.id != '' && user_id = @request.auth.id"
    memberships.viewRule = "@request.auth.id != '' && user_id = @request.auth.id"
    memberships.createRule = ''
    memberships.updateRule = ''
    memberships.deleteRule = ''
    app.save(memberships)

    const audit = app.findCollectionByNameOrId('audit_events')
    audit.listRule = "@request.auth.id != '' && actor_id = @request.auth.id"
    audit.viewRule = "@request.auth.id != '' && actor_id = @request.auth.id"
    audit.createRule = ''
    audit.updateRule = ''
    audit.deleteRule = ''
    app.save(audit)
  },
  (app) => {
    // Down: devolve as regras do estado anterior (idênticas — reversão segura).
    const memberships = app.findCollectionByNameOrId('memberships')
    memberships.listRule = "@request.auth.id != '' && user_id = @request.auth.id"
    memberships.viewRule = "@request.auth.id != '' && user_id = @request.auth.id"
    memberships.createRule = ''
    memberships.updateRule = ''
    memberships.deleteRule = ''
    app.save(memberships)

    const audit = app.findCollectionByNameOrId('audit_events')
    audit.listRule = "@request.auth.id != '' && actor_id = @request.auth.id"
    audit.viewRule = "@request.auth.id != '' && actor_id = @request.auth.id"
    audit.createRule = ''
    audit.updateRule = ''
    audit.deleteRule = ''
    app.save(audit)
  },
)
