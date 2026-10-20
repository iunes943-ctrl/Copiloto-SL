// SPEC-1-001/C1+C3 — CORREÇÃO CRÍTICA de regras de acesso.
// Achado (20/10/2026): nesta versão do PocketBase, regra vazia ('') NÃO fecha
// o acesso — abre ao público (string vazia = todos; null = só superusuário/
// backend). As migrações 0001–0005 usaram '' para "fechar" create/update/
// delete de memberships, audit_events e users, e o teste de integridade provou:
// qualquer conta autenticada criava/editava/apagava vínculos e eventos de
// auditoria, e havia auto-registro público de contas (sem autenticação).
// Correção: toda regra que deve negar passa a null. Listas de catálogo
// (tenants/units) também fecham; view de units/tenants permanece para
// autenticados (necessária ao expand do front). Reversão dos artefatos do
// teste de concessão (dados sintéticos): att2 volta a ['attendant'] e
// role_grants limpo; o evento de auditoria permanece (append-only).
// Down intencionalmente vazio: restaurar regras abertas reabriria o buraco —
// reversão manual somente com autorização.
migrate(
  (app) => {
    const memberships = app.findCollectionByNameOrId('memberships')
    memberships.createRule = null
    memberships.updateRule = null
    memberships.deleteRule = null
    app.save(memberships)

    const audit = app.findCollectionByNameOrId('audit_events')
    audit.createRule = null
    audit.updateRule = null
    audit.deleteRule = null
    app.save(audit)

    const users = app.findCollectionByNameOrId('users')
    users.createRule = null
    users.deleteRule = null
    app.save(users)

    const tenants = app.findCollectionByNameOrId('tenants')
    tenants.listRule = null
    app.save(tenants)

    const units = app.findCollectionByNameOrId('units')
    units.listRule = null
    app.save(units)

    // Limpeza do teste de concessão (modo demonstração, dados sintéticos).
    try {
      const att2 = app.findAuthRecordByEmail('users', 'demo.att2@sl.demo')
      try {
        const m = app.findFirstRecordByFilter('memberships', 'user_id = {:u}', { u: att2.id })
        m.set('roles', ['attendant'])
        app.save(m)
      } catch (_) {}
      att2.set('role_grants', [])
      app.save(att2)
    } catch (_) {}
  },
  (app) => {
    // Down vazio de propósito — ver cabeçalho.
  },
)
