// SPEC-1-001/C3 — limpeza do teste de concessão (modo demonstração).
// att2 volta a ['attendant'] e role_grants vazio; o evento de auditoria
// permanece (append-only). Down vazio: nada a restaurar.
migrate(
  (app) => {
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
  (app) => {},
)
