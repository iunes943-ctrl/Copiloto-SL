// SPEC-1-002/C2 — candidatos de oferta (offer_candidates): versões de
// argumento comercial + preço por exame, com DUAS aprovações separadas
// (técnica e comercial) e escopo (tabela, vigência). Escrita NUNCA pela API
// do cliente (null) — só pelas rotas backend auditadas. Nada fica ativo sem
// as duas aprovações e escopo válido (conferido no servidor).
migrate(
  (app) => {
    const col = new Collection({
      name: 'offer_candidates',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'exam_key', type: 'text', required: true, max: 200 },
        { name: 'exam_code_raw', type: 'text', required: true, max: 200 },
        { name: 'description', type: 'text', required: true, max: 500 },
        { name: 'argumento', type: 'text', required: true, max: 1000 },
        { name: 'price_reference', type: 'text', required: true, max: 50 },
        { name: 'price_final', type: 'text', required: false, max: 50 },
        { name: 'table_ref', type: 'text', required: true, max: 100 },
        { name: 'vigencia_inicio', type: 'date', required: true },
        { name: 'vigencia_fim', type: 'date', required: true },
        { name: 'unit_id', type: 'relation', required: false, collectionId: 'pbc_586599074', maxSelect: 1 },
        { name: 'aprovacao_tecnica', type: 'bool', required: false },
        { name: 'aprovacao_comercial', type: 'bool', required: false },
        { name: 'active', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_offer_candidates_key ON offer_candidates (exam_key)',
        'CREATE INDEX idx_offer_candidates_active ON offer_candidates (active)',
      ],
    })
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('offer_candidates')
    app.delete(col)
  },
)
