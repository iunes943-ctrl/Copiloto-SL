// SPEC-1-002/C2 — aprovações separadas (técnica e comercial), ativação e pausa.
// Alçada conferida inline no servidor (lição JSVM: nada de função top-level).
// Ativação exige as DUAS aprovações + vigência corrente. Toda ação grava
// audit_events. Pausa desativa e preserva aprovações (histórico).
routerAdd(
  'POST',
  '/backend/v1/ofertas/aprovar-tecnica',
  (e) => {
    const auth = e.auth
    if (!auth || !auth.id) throw new UnauthorizedError('Sessão ausente.')
    const body = e.requestInfo().body
    const id = body && body.id ? String(body.id) : ''
    if (!id) throw new BadRequestError('Candidato não informado.')
    let temAlcada = false
    try {
      const rels = $app.findRecordsByFilter('memberships', 'user_id = {:u} && active = true', '', 200, 0, { u: auth.id })
      for (const m of rels) {
        const roles = m.getStringSlice('roles')
        if (roles.includes('curator_technical') || roles.includes('admin')) {
          temAlcada = true
          break
        }
      }
    } catch (_) {}
    if (!temAlcada) throw new ForbiddenError('Sem alçada para esta aprovação.')
    let rec
    try {
      rec = $app.findRecordById('offer_candidates', id)
    } catch (_) {
      throw new BadRequestError('Candidato não encontrado.')
    }
    if (rec.getBool('aprovacao_tecnica')) throw new BadRequestError('Aprovação já registrada.')
    rec.set('aprovacao_tecnica', true)
    $app.save(rec)
    const auditCol = $app.findCollectionByNameOrId('audit_events')
    const audit = new Record(auditCol)
    audit.set('actor_id', auth.id)
    audit.set('action', 'offer_approved_technical')
    audit.set('entity_ref', 'offer_candidates/' + id)
    audit.set('tenant_id', '')
    audit.set('unit_id', '')
    audit.set('outcome', 'ok')
    audit.set('detail', JSON.stringify({ exam_key: rec.getString('exam_key') }))
    $app.save(audit)
    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/ofertas/aprovar-comercial',
  (e) => {
    const auth = e.auth
    if (!auth || !auth.id) throw new UnauthorizedError('Sessão ausente.')
    const body = e.requestInfo().body
    const id = body && body.id ? String(body.id) : ''
    if (!id) throw new BadRequestError('Candidato não informado.')
    let temAlcada = false
    try {
      const rels = $app.findRecordsByFilter('memberships', 'user_id = {:u} && active = true', '', 200, 0, { u: auth.id })
      for (const m of rels) {
        const roles = m.getStringSlice('roles')
        if (roles.includes('curator_commercial') || roles.includes('admin')) {
          temAlcada = true
          break
        }
      }
    } catch (_) {}
    if (!temAlcada) throw new ForbiddenError('Sem alçada para esta aprovação.')
    let rec
    try {
      rec = $app.findRecordById('offer_candidates', id)
    } catch (_) {
      throw new BadRequestError('Candidato não encontrado.')
    }
    if (rec.getBool('aprovacao_comercial')) throw new BadRequestError('Aprovação já registrada.')
    rec.set('aprovacao_comercial', true)
    $app.save(rec)
    const auditCol = $app.findCollectionByNameOrId('audit_events')
    const audit = new Record(auditCol)
    audit.set('actor_id', auth.id)
    audit.set('action', 'offer_approved_commercial')
    audit.set('entity_ref', 'offer_candidates/' + id)
    audit.set('tenant_id', '')
    audit.set('unit_id', '')
    audit.set('outcome', 'ok')
    audit.set('detail', JSON.stringify({ exam_key: rec.getString('exam_key') }))
    $app.save(audit)
    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/ofertas/ativar',
  (e) => {
    const auth = e.auth
    if (!auth || !auth.id) throw new UnauthorizedError('Sessão ausente.')
    const body = e.requestInfo().body
    const id = body && body.id ? String(body.id) : ''
    if (!id) throw new BadRequestError('Candidato não informado.')
    let temAlcada = false
    try {
      const rels = $app.findRecordsByFilter('memberships', 'user_id = {:u} && active = true', '', 200, 0, { u: auth.id })
      for (const m of rels) {
        const roles = m.getStringSlice('roles')
        if (roles.some((r) => ['admin', 'curator_technical', 'curator_commercial'].includes(r))) {
          temAlcada = true
          break
        }
      }
    } catch (_) {}
    if (!temAlcada) throw new ForbiddenError('Sem alçada para ativar ofertas.')
    let rec
    try {
      rec = $app.findRecordById('offer_candidates', id)
    } catch (_) {
      throw new BadRequestError('Candidato não encontrado.')
    }
    if (!rec.getBool('aprovacao_tecnica') || !rec.getBool('aprovacao_comercial')) {
      throw new BadRequestError('Ativação exige aprovação técnica E comercial.')
    }
    const agora = new Date()
    const inicio = rec.getDateTime('vigencia_inicio').string()
    const fim = rec.getDateTime('vigencia_fim').string()
    if (!(inicio && fim) || agora < new Date(inicio) || agora > new Date(fim)) {
      throw new BadRequestError('Fora da vigência configurada.')
    }
    rec.set('active', true)
    $app.save(rec)
    const auditCol = $app.findCollectionByNameOrId('audit_events')
    const audit = new Record(auditCol)
    audit.set('actor_id', auth.id)
    audit.set('action', 'offer_activated')
    audit.set('entity_ref', 'offer_candidates/' + id)
    audit.set('tenant_id', '')
    audit.set('unit_id', '')
    audit.set('outcome', 'ok')
    audit.set('detail', JSON.stringify({ exam_key: rec.getString('exam_key') }))
    $app.save(audit)
    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/ofertas/pausar',
  (e) => {
    const auth = e.auth
    if (!auth || !auth.id) throw new UnauthorizedError('Sessão ausente.')
    const body = e.requestInfo().body
    const id = body && body.id ? String(body.id) : ''
    if (!id) throw new BadRequestError('Candidato não informado.')
    let temAlcada = false
    try {
      const rels = $app.findRecordsByFilter('memberships', 'user_id = {:u} && active = true', '', 200, 0, { u: auth.id })
      for (const m of rels) {
        const roles = m.getStringSlice('roles')
        if (roles.some((r) => ['admin', 'curator_technical', 'curator_commercial'].includes(r))) {
          temAlcada = true
          break
        }
      }
    } catch (_) {}
    if (!temAlcada) throw new ForbiddenError('Sem alçada para pausar ofertas.')
    let rec
    try {
      rec = $app.findRecordById('offer_candidates', id)
    } catch (_) {
      throw new BadRequestError('Candidato não encontrado.')
    }
    rec.set('active', false)
    $app.save(rec)
    const auditCol = $app.findCollectionByNameOrId('audit_events')
    const audit = new Record(auditCol)
    audit.set('actor_id', auth.id)
    audit.set('action', 'offer_paused')
    audit.set('entity_ref', 'offer_candidates/' + id)
    audit.set('tenant_id', '')
    audit.set('unit_id', '')
    audit.set('outcome', 'ok')
    audit.set('detail', JSON.stringify({ exam_key: rec.getString('exam_key') }))
    $app.save(audit)
    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)
