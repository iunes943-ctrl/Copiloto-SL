// SPEC-1-001/C3 — rota ÚNICA de concessão de papel, explicita e auditada.
// Quem concede: admin ou diretoria (alçada conferida no servidor, via
// memberships ativas do actor). Nunca a si mesmo. Papel precisa estar na
// lista do sistema. Toda concessão grava audit_events (append-only, criado
// só aqui e no hook de troca de unidade — createRule da coleção é fechado).
// O papel concedido é refletido em memberships (fonte da sessão) e em
// users.role_grants (registro de concessões da conta), sempre pelo backend.
// Usuário sem vínculo ativo no tenant recebe erro claro: o primeiro vínculo
// (com unidade) é provisionamento, não concessão de papel.
routerAdd(
  'POST',
  '/backend/v1/papeis/conceder',
  (e) => {
    const auth = e.auth
    if (!auth || !auth.id) {
      throw new UnauthorizedError('Sessão ausente.')
    }
    const body = e.requestInfo().body
    const targetUserId = body && body.user_id ? String(body.user_id) : ''
    const requestedRoles =
      body && Array.isArray(body.roles) ? body.roles.map((r) => String(r)) : []
    if (!targetUserId || requestedRoles.length === 0) {
      throw new BadRequestError('Usuário e papel são obrigatórios.')
    }

    const PAPEIS = ['attendant', 'leader', 'manager', 'director', 'admin', 'curator_technical', 'curator_commercial']
    if (requestedRoles.some((r) => !PAPEIS.includes(r))) {
      throw new BadRequestError('Papel fora da lista do sistema.')
    }
    if (targetUserId === auth.id) {
      throw new ForbiddenError('Não é possível conceder papel a si mesmo.')
    }

    // Alçada: admin ou diretoria, via memberships ativas conferidas no servidor.
    let actorMemberships
    try {
      actorMemberships = $app.findRecordsByFilter(
        'memberships',
        'user_id = {:u} && active = true',
        '',
        200,
        0,
        { u: auth.id },
      )
    } catch (_) {
      throw new ForbiddenError('Sem alçada para conceder papéis.')
    }
    let temAlcada = false
    let tenantId = ''
    for (const m of actorMemberships) {
      const roles = m.getStringSlice('roles')
      if (roles.includes('admin') || roles.includes('director')) {
        temAlcada = true
        tenantId = m.getString('tenant_id')
        break
      }
    }
    if (!temAlcada) {
      throw new ForbiddenError('Sem alçada para conceder papéis.')
    }

    // Alvo precisa existir e estar ativo.
    let target
    try {
      target = $app.findRecordById('users', targetUserId)
    } catch (_) {
      throw new BadRequestError('Usuário não encontrado.')
    }
    if (!target.getBool('active')) {
      throw new BadRequestError('Usuário inativo não recebe papel.')
    }

    // Vínculo ativo do alvo no tenant da alçada: a concessão ajusta papéis
    // de vínculo existente. Sem vínculo, erro claro (provisionamento é outro
    // passo, com unidade definida).
    let membership
    try {
      membership = $app.findFirstRecordByFilter(
        'memberships',
        'user_id = {:u} && tenant_id = {:t} && active = true',
        { u: targetUserId, t: tenantId },
      )
    } catch (_) {
      throw new BadRequestError('Usuário sem vínculo ativo neste tenant; primeiro vincule-o a uma unidade.')
    }
    const currentRoles = membership.getStringSlice('roles')
    const merged = Array.from(new Set([...currentRoles, ...requestedRoles]))
    membership.set('roles', merged)
    $app.save(membership)

    // Registro de concessões na conta (também só pelo backend).
    const grants = target.getStringSlice('role_grants')
    target.set('role_grants', Array.from(new Set([...grants, ...requestedRoles])))
    $app.save(target)

    // Auditoria: quem concedeu, para quem, qual papel, quando.
    const auditCol = $app.findCollectionByNameOrId('audit_events')
    const audit = new Record(auditCol)
    audit.set('actor_id', auth.id)
    audit.set('action', 'role_grant')
    audit.set('entity_ref', 'users/' + targetUserId)
    audit.set('tenant_id', tenantId)
    audit.set('unit_id', '')
    audit.set('outcome', 'ok')
    audit.set('detail', JSON.stringify({ roles: requestedRoles }))
    $app.save(audit)

    return e.json(200, { ok: true, roles: merged })
  },
  $apis.requireAuth(),
)
