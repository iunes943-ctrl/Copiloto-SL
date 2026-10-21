// SPEC-1-002/C2 — criação auditada de candidato de oferta.
// Alçada: curadores ou admin (via memberships ativas). Exame precisa existir
// no catálogo e não pode estar em conflito sem decisão. Sai inativo e sem
// aprovações — ativação é rota separada, com as duas alçadas.
routerAdd(
  'POST',
  '/backend/v1/ofertas/candidato',
  (e) => {
    const auth = e.auth
    if (!auth || !auth.id) throw new UnauthorizedError('Sessão ausente.')
    const body = e.requestInfo().body
    const examKey = body && body.exam_key ? String(body.exam_key).trim().toUpperCase() : ''
    const argumento = body && body.argumento ? String(body.argumento).trim() : ''
    const priceFinal = body && body.price_final ? String(body.price_final).trim() : ''
    const tableRef = body && body.table_ref ? String(body.table_ref).trim() : ''
    const vigInicio = body && body.vigencia_inicio ? String(body.vigencia_inicio) : ''
    const vigFim = body && body.vigencia_fim ? String(body.vigencia_fim) : ''
    if (!examKey || !argumento || !tableRef || !vigInicio || !vigFim) {
      throw new BadRequestError('Exame, argumento, tabela e vigência são obrigatórios.')
    }

    let temAlcada = false
    let tenantId = ''
    try {
      const rels = $app.findRecordsByFilter('memberships', 'user_id = {:u} && active = true', '', 200, 0, { u: auth.id })
      for (const m of rels) {
        const roles = m.getStringSlice('roles')
        if (roles.some((r) => ['admin', 'curator_technical', 'curator_commercial'].includes(r))) {
          temAlcada = true
          tenantId = m.getString('tenant_id')
          break
        }
      }
    } catch (_) {}
    if (!temAlcada) throw new ForbiddenError('Sem alçada para preparar ofertas.')

    let exam
    try {
      exam = $app.findFirstRecordByFilter('exam_catalog', 'code_normalized = {:k}', { k: examKey })
    } catch (_) {
      throw new BadRequestError('Exame não encontrado no catálogo.')
    }
    if (exam.getBool('conflict') && !exam.getString('conflict_resolution')) {
      throw new BadRequestError('Exame em conflito aguarda decisão do champion.')
    }

    const col = $app.findCollectionByNameOrId('offer_candidates')
    const rec = new Record(col)
    rec.set('exam_key', examKey)
    rec.set('exam_code_raw', exam.getString('code_raw'))
    rec.set('description', exam.getString('description'))
    rec.set('argumento', argumento)
    rec.set('price_reference', exam.getString('price_raw_decimal'))
    rec.set('price_final', priceFinal)
    rec.set('table_ref', tableRef)
    rec.set('vigencia_inicio', vigInicio)
    rec.set('vigencia_fim', vigFim)
    rec.set('aprovacao_tecnica', false)
    rec.set('aprovacao_comercial', false)
    rec.set('active', false)
    $app.save(rec)

    const auditCol = $app.findCollectionByNameOrId('audit_events')
    const audit = new Record(auditCol)
    audit.set('actor_id', auth.id)
    audit.set('action', 'offer_candidate_created')
    audit.set('entity_ref', 'offer_candidates/' + rec.id)
    audit.set('tenant_id', tenantId)
    audit.set('unit_id', '')
    audit.set('outcome', 'ok')
    audit.set('detail', JSON.stringify({ exam_key: examKey, table_ref: tableRef }))
    $app.save(audit)

    return e.json(200, { ok: true, id: rec.id })
  },
  $apis.requireAuth(),
)
