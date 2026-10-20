// SPEC-1-001 — seed de demonstração (modo demonstracao, dados sintéticos).
// Idempotente: try/catch nos finders; nada de dado real de paciente.
migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const unitsCol = app.findCollectionByNameOrId('units')
    const membershipsCol = app.findCollectionByNameOrId('memberships')
    const usersCol = app.findCollectionByNameOrId('users')

    const ensureTenant = (externalKey, name) => {
      try {
        return app.findFirstRecordByFilter('tenants', 'external_key = {:k}', { k: externalKey })
      } catch (_) {
        const r = new Record(tenantsCol)
        r.set('external_key', externalKey)
        r.set('name', name)
        r.set('active', true)
        app.save(r)
        return r
      }
    }

    const ensureUnit = (externalKey, name, tenantId) => {
      try {
        return app.findFirstRecordByFilter('units', 'external_key = {:k}', { k: externalKey })
      } catch (_) {
        const r = new Record(unitsCol)
        r.set('external_key', externalKey)
        r.set('name', name)
        r.set('active', true)
        r.set('tenant_id', tenantId)
        app.save(r)
        return r
      }
    }

    const ensureUser = (email, name) => {
      try {
        return app.findAuthRecordByEmail('users', email)
      } catch (_) {
        const r = new Record(usersCol)
        r.set('email', email)
        r.set('password', 'Demo12345')
        r.set('passwordConfirm', 'Demo12345')
        r.set('name', name)
        r.set('verified', true)
        r.set('emailVisibility', true)
        r.set('active', true)
        app.save(r)
        return r
      }
    }

    const ensureMembership = (userId, tenantId, unitId, roles) => {
      try {
        return app.findFirstRecordByFilter('memberships', 'user_id = {:u} && unit_id = {:p}', { u: userId, p: unitId })
      } catch (_) {
        const r = new Record(membershipsCol)
        r.set('user_id', userId)
        r.set('tenant_id', tenantId)
        r.set('unit_id', unitId)
        r.set('roles', roles)
        r.set('active', true)
        app.save(r)
        return r
      }
    }

    const t1 = ensureTenant('DEMO-T1', 'Laboratório São Luiz (demonstração)')
    const t2 = ensureTenant('DEMO-T2', 'Tenant demonstração 2')
    const u1 = ensureUnit('DEMO-U1', 'Matriz (demonstração)', t1.id)
    const u2 = ensureUnit('DEMO-U2', 'Unidade 2 (demonstração)', t1.id)
    const u3 = ensureUnit('DEMO-U3', 'Unidade 3 (demonstração)', t2.id)

    const att1 = ensureUser('demo.att1@sl.demo', 'Atendente Demo 1')
    const att2 = ensureUser('demo.att2@sl.demo', 'Atendente Demo 2')
    const mgr = ensureUser('demo.mgr@sl.demo', 'Gestora Demo')

    ensureMembership(att1.id, t1.id, u1.id, ['attendant'])
    ensureMembership(att2.id, t1.id, u2.id, ['attendant'])
    ensureMembership(mgr.id, t1.id, u1.id, ['manager'])
    ensureMembership(mgr.id, t1.id, u2.id, ['manager'])
  },
  (app) => {
    // Down: memberships primeiro (referenciam users/units), depois users,
    // units e tenants — ordem que respeita as relações.
    const emails = ['demo.att1@sl.demo', 'demo.att2@sl.demo', 'demo.mgr@sl.demo']
    const userIds = []
    for (const email of emails) {
      try {
        const u = app.findAuthRecordByEmail('users', email)
        userIds.push(u.id)
      } catch (_) {}
    }
    for (const uid of userIds) {
      try {
        const rels = app.findRecordsByFilter('memberships', 'user_id = {:u}', '', 500, 0, { u: uid })
        for (const rel of rels) app.delete(rel)
      } catch (_) {}
    }
    for (const uid of userIds) {
      try {
        const u = app.findAuthRecordByEmail('users', emails[userIds.indexOf(uid)])
        app.delete(u)
      } catch (_) {}
    }
    for (const key of ['DEMO-U1', 'DEMO-U2', 'DEMO-U3']) {
      try {
        const unit = app.findFirstRecordByFilter('units', 'external_key = {:k}', { k: key })
        app.delete(unit)
      } catch (_) {}
    }
    for (const key of ['DEMO-T1', 'DEMO-T2']) {
      try {
        const tenant = app.findFirstRecordByFilter('tenants', 'external_key = {:k}', { k: key })
        app.delete(tenant)
      } catch (_) {}
    }
  },
)
