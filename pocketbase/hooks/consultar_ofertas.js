// SPEC-1-002/C3 — consulta de oferta por perfil/unidade, regra no servidor.
// Mesmas regras do front: ativa, duas aprovações, vigência corrente, unidade
// conferida (vínculo do actor); preço: usa price_final e cai para a
// referência quando vazio (nunca inventa); normaliza para 2 casas; empate
// resolve pela vigência mais restrita. Consulta é leitura, sem auditoria.
routerAdd(
  'POST',
  '/backend/v1/ofertas/consultar',
  (e) => {
    const auth = e.auth
    if (!auth || !auth.id) throw new UnauthorizedError('Sessão ausente.')
    const body = e.requestInfo().body
    const examKey = body && body.exam_key ? String(body.exam_key).trim().toUpperCase() : ''
    const perfil = body && body.perfil ? String(body.perfil).trim() : ''
    const unitId = body && body.unit_id ? String(body.unit_id).trim() : ''
    if (!examKey || !perfil || !unitId) {
      throw new BadRequestError('Exame, perfil e unidade são obrigatórios.')
    }
    // A unidade pedida precisa ser vínculo ativo do actor (isolamento C1).
    let unidadeOk = false
    try {
      const rels = $app.findRecordsByFilter('memberships', 'user_id = {:u} && active = true', '', 200, 0, { u: auth.id })
      for (const m of rels) {
        if (m.getString('unit_id') === unitId) {
          unidadeOk = true
          break
        }
      }
    } catch (_) {}
    if (!unidadeOk) throw new ForbiddenError('Unidade não autorizada para este usuário.')

    const agora = new Date()
    let ofertas
    try {
      ofertas = $app.findRecordsByFilter(
        'offer_candidates',
        'exam_key = {:k} && active = true && aprovacao_tecnica = true && aprovacao_comercial = true',
        '',
        200,
        0,
        { k: examKey },
      )
    } catch (_) {
      ofertas = []
    }
    const elegiveis = []
    for (const o of ofertas) {
      const oUnit = o.getString('unit_id')
      if (oUnit && oUnit !== unitId) continue
      const inicio = o.getDateTime('vigencia_inicio').string()
      const fim = o.getDateTime('vigencia_fim').string()
      if (!inicio || !fim) continue
      const i = new Date(inicio)
      const f = new Date(fim)
      if (Number.isNaN(i.getTime()) || Number.isNaN(f.getTime())) continue
      if (agora < i || agora > f) continue
      // Preço: price_final tem prioridade; referência quando vazio (nunca inventa).
      let preco = o.getString('price_final')
      if (!preco || !Number.isFinite(Number(preco))) {
        preco = o.getString('price_reference')
      }
      if (!preco || !Number.isFinite(Number(preco))) continue
      // Normaliza para 2 casas (moeda) — formatação pt-BR fica na tela.
      preco = (Math.round(Number(preco) * 100) / 100).toFixed(2)
      elegiveis.push({ o, preco, inicio, fim })
    }
    if (elegiveis.length === 0) {
      return e.json(200, { ok: true, oferta: null })
    }
    elegiveis.sort((a, b) => {
      const fa = new Date(a.fim).getTime()
      const fb = new Date(b.fim).getTime()
      if (fa !== fb) return fa - fb
      const ia = new Date(a.inicio).getTime()
      const ib = new Date(b.inicio).getTime()
      return ib - ia
    })
    const escolhida = elegiveis[0]
    return e.json(200, {
      ok: true,
      oferta: {
        exam_key: escolhida.o.getString('exam_key'),
        description: escolhida.o.getString('description'),
        argumento: escolhida.o.getString('argumento'),
        preco: escolhida.preco,
        origem_preco: escolhida.o.getString('price_final') ? 'final' : 'referencia',
      },
    })
  },
  $apis.requireAuth(),
)
