// SPEC-1-001/C3 — admin de demonstração para exercitar a concessão auditada.
// Dados sintéticos (modo demonstracao); idempotente.
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('users')
    const membershipsCol = app.findCollectionByNameOrId('memberships')

    let admin
    try {
      admin = app.findAuthRecordByEmail('users', 'demo.admin@sl.demo')
    } catch (_) {
      admin = new Record(usersCol)
      admin.set('email', 'demo.admin@sl.demo')
      admin.set('password', 'Demo12345')
      admin.set('passwordConfirm', 'Demo12345')
      admin.set('name', 'Administrador Demo')
      admin.set('verified', true)
      admin.set('emailVisibility', true)
      admin.set('active', true)
      app.save(admin)
    }

    const tenant = app.findFirstRecordByFilter('tenants', 'external_key = {:k}', { k: 'DEMO-T1' })
    for (const unitKey of ['DEMO-U1', 'DEMO-U2']) {
      const unit = app.findFirstRecordByFilter('units', 'external_key = {:k}', { k: unitKey })
      try {
        app.findFirstRecordByFilter(
          'memberships',
          'user_id = {:u} && unit_id = {:p}',
          { u: admin.id, p: unit.id },
        )
      } catch (_) {
        const r = new Record(membershipsCol)
        r.set('user_id', admin.id)
        r.set('tenant_id', tenant.id)
        r.set('unit_id', unit.id)
        r.set('roles', ['admin'])
        r.set('active', true)
        app.save(r)
      }
    }
  },
  (app) => {
    // Down: remove memberships e o usuário do admin demo.
    try {
      const admin = app.findAuthRecordByEmail('users', 'demo.admin@sl.demo')
      try {
        const rels = app.findRecordsByFilter('memberships', 'user_id = {:u}', '', 500, 0, { u: admin.id })
        for (const rel of rels) app.delete(rel)
      } catch (_) {}
      app.delete(admin)
    } catch (_) {}
  },
)
