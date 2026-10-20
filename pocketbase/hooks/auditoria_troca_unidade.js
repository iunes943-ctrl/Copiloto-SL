// SPEC-1-001 — auditoria de mudança de escopo (troca de unidade).
// O cliente NÃO cria audit_events: só esta rota backend grava, com o actor
// vindo da sessão autenticada e o vínculo conferido no servidor.
routerAdd(
  'POST',
  '/backend/v1/auditoria/troca-unidade',
  (e) => {
    const auth = e.auth
    if (!auth || !auth.id) {
      throw new UnauthorizedError('Sessão ausente.')
    }
    const body = e.requestInfo().body
    const unitId = body && body.unit_id ? String(body.unit_id) : ''
    if (!unitId) {
      throw new BadRequestError('Unidade não informada.')
    }

    // O vínculo ativo do actor para esta unidade é conferido no servidor,
    // nunca confiado ao corpo da requisição.
    let membership
    try {
      membership = $app.findFirstRecordByFilter(
        'memberships',
        'user_id = {:u} && unit_id = {:p} && active = true',
        { u: auth.id, p: unitId },
      )
    } catch (_) {
      throw new ForbiddenError('Unidade não autorizada para este usuário.')
    }

    const auditCol = $app.findCollectionByNameOrId('audit_events')
    const record = new Record(auditCol)
    record.set('actor_id', auth.id)
    record.set('action', 'unit_scope_change')
    record.set('entity_ref', 'memberships/' + membership.id)
    record.set('tenant_id', membership.getString('tenant_id'))
    record.set('unit_id', unitId)
    record.set('outcome', 'ok')
    $app.save(record)

    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)
