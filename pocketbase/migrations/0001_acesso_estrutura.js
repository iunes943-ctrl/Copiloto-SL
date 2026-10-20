// SPEC-1-001 — estrutura de acesso: tenants, units, memberships + users.active.
// Migration aditiva; down desfaz na ordem inversa.
migrate(
  (app) => {
    const tenants = new Collection({
      name: 'tenants',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'external_key', type: 'text', required: true, max: 100 },
        { name: 'name', type: 'text', required: true, max: 200 },
        { name: 'active', type: 'bool', required: true },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_tenants_external_key ON tenants (external_key)',
      ],
    })
    app.save(tenants)

    const tenantsId = app.findCollectionByNameOrId('tenants').id

    const units = new Collection({
      name: 'units',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'external_key', type: 'text', required: true, max: 100 },
        { name: 'name', type: 'text', required: true, max: 200 },
        { name: 'active', type: 'bool', required: true },
        { name: 'tenant_id', type: 'relation', required: true, collectionId: tenantsId, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_units_external_key ON units (external_key)',
        'CREATE INDEX idx_units_tenant ON units (tenant_id)',
      ],
    })
    app.save(units)

    const unitsId = app.findCollectionByNameOrId('units').id

    const memberships = new Collection({
      name: 'memberships',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'user_id', type: 'relation', required: true, collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'tenant_id', type: 'relation', required: true, collectionId: tenantsId, maxSelect: 1 },
        { name: 'unit_id', type: 'relation', required: true, collectionId: unitsId, maxSelect: 1 },
        { name: 'roles', type: 'select', required: true, maxSelect: 6, values: ['attendant', 'leader', 'manager', 'director', 'admin', 'curator_technical', 'curator_commercial'] },
        { name: 'active', type: 'bool', required: true },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_memberships_user_unit ON memberships (user_id, unit_id)',
        'CREATE INDEX idx_memberships_user ON memberships (user_id)',
      ],
    })
    app.save(memberships)

    // users.active: conta inativa não entra (hook bloqueia no login).
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('active')) {
      users.fields.add(new BoolField({ name: 'active' }))
      app.save(users)
    }
  },
  (app) => {
    const memberships = app.findCollectionByNameOrId('memberships')
    app.delete(memberships)
    const units = app.findCollectionByNameOrId('units')
    app.delete(units)
    const tenants = app.findCollectionByNameOrId('tenants')
    app.delete(tenants)
    const users = app.findCollectionByNameOrId('users')
    if (users.fields.getByName('active')) {
      users.fields.removeByName('active')
      app.save(users)
    }
  },
)
