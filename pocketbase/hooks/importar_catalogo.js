// SPEC-1-002/C1 — importação auditada do catálogo (lote fechado, sem parcial).
// Alçada: admin (conferida no servidor via memberships ativas). Recebe as
// linhas do insumo, re-executa a MESMA normalização/análise do front
// (trim+upper, conflito por chave com preços diferentes), grava o lote com
// price_approved=false e active=false, grava audit_events e devolve o resumo.
// Re-importação do mesmo lote é recusada (nunca sobrescreve preço anterior).
routerAdd(
  'POST',
  '/backend/v1/catalogo/importar',
  (e) => {
    const auth = e.auth
    if (!auth || !auth.id) {
      throw new UnauthorizedError('Sessão ausente.')
    }
    const body = e.requestInfo().body
    const rows = body && Array.isArray(body.rows) ? body.rows : []
    if (rows.length === 0) {
      throw new BadRequestError('Nenhuma linha recebida para importação.')
    }

    // Alçada: admin, via memberships ativas.
    let temAlcada = false
    try {
      const rels = $app.findRecordsByFilter('memberships', 'user_id = {:u} && active = true', '', 200, 0, { u: auth.id })
      for (const m of rels) {
        if (m.getStringSlice('roles').includes('admin')) {
          temAlcada = true
          break
        }
      }
    } catch (_) {}
    if (!temAlcada) {
      throw new ForbiddenError('Sem alçada para importar o catálogo.')
    }

    // Re-executa a análise no servidor (fonte da verdade).
    const normalizar = (s) => String(s).trim().toUpperCase()
    const porChave = new Map()
    for (const r of rows) {
      const chave = normalizar(r.code_raw)
      const preco = Number(r.price_raw_decimal)
      const atual = porChave.get(chave)
      if (!atual) porChave.set(chave, { preco, linhas: [r.source_row] })
      else {
        if (Math.abs(atual.preco - preco) > 1e-9) atual.preco = NaN
        atual.linhas.push(r.source_row)
      }
    }
    const conflitos = [...porChave.entries()].filter(([, v]) => Number.isNaN(v.preco))

    // Lote fechado: um batch_scope por importação. Re-importação do mesmo
    // lote é recusada (nunca sobrescreve preço anterior).
    const batchScope = 'lote-' + new Date().toISOString().slice(0, 10)
    let existing
    try {
      existing = $app.findFirstRecordByFilter('exam_catalog', 'batch_scope = {:b}', { b: batchScope })
    } catch (_) {}
    if (existing) {
      throw new BadRequestError('Lote de hoje já importado; use um lote novo (nunca sobrescreve preço anterior).')
    }

    const col = $app.findCollectionByNameOrId('exam_catalog')
    let gravadas = 0
    for (const r of rows) {
      const chave = normalizar(r.code_raw)
      const rec = new Record(col)
      rec.set('source_row', Number(r.source_row))
      rec.set('code_raw', String(r.code_raw))
      rec.set('code_normalized', chave)
      rec.set('description', String(r.description))
      rec.set('price_raw_decimal', String(r.price_raw_decimal))
      rec.set('currency', r.currency ? String(r.currency) : 'BRL')
      const emConflito = conflitos.some(([k]) => k === chave)
      rec.set('conflict', emConflito)
      rec.set('price_approved', false)
      rec.set('active', false)
      rec.set('batch_scope', batchScope)
      $app.save(rec)
      gravadas++
    }

    // Auditoria da importação.
    const auditCol = $app.findCollectionByNameOrId('audit_events')
    const audit = new Record(auditCol)
    audit.set('actor_id', auth.id)
    audit.set('action', 'catalog_import')
    audit.set('entity_ref', 'exam_catalog/' + batchScope)
    audit.set('tenant_id', '')
    audit.set('unit_id', '')
    audit.set('outcome', 'ok')
    audit.set('detail', JSON.stringify({ total: rows.length, gravadas, conflitos: conflitos.length }))
    $app.save(audit)

    return e.json(200, {
      ok: true,
      batch_scope: batchScope,
      total: rows.length,
      gravadas,
      conflitos: conflitos.map(([k, v]) => ({ chave: k, linhas: v.linhas })),
    })
  },
  $apis.requireAuth(),
)
