// SPEC-1-001 — auditoria (audit_events): concessões, revogações e mudança de escopo.
// Append-only na prática: web não cria, não edita e não apaga — só rotas backend.
migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('tenants').id
    const unitsId = app.findCollectionByNameOrId('units').id

    const audit = new Collection({
      name: 'audit_events',
      type: 'base',
      listRule: "@request.auth.id != '' && actor_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && actor_id = @request.auth.id",
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'actor_id', type: 'relation', required: true, collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'action', type: 'text', required: true, max: 100 },
        { name: 'entity_ref', type: 'text', required: true, max: 200 },
        { name: 'tenant_id', type: 'relation', collectionId: tenantsId, maxSelect: 1 },
        { name: 'unit_id', type: 'relation', collectionId: unitsId, maxSelect: 1 },
        { name: 'outcome', type: 'text', required: true, max: 50 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_actor ON audit_events (actor_id, created)',
      ],
    })
    app.save(audit)
  },
  (app) => {
    const audit = app.findCollectionByNameOrId('audit_events')
    app.delete(audit)
  },
)
