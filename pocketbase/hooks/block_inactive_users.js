// SPEC-1-001 — conta inativa não entra (sem vazar existência de registro).
// Passa o collection 'users' para nunca bloquear o superusuário da plataforma.
onRecordAuthWithPasswordRequest((e) => {
  if (e.record && e.record.get('active') === false) {
    throw new BadRequestError('Conta inativa. Procure o administrador do sistema.')
  }
  return e.next()
}, 'users')
