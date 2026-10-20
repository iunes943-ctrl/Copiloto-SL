// SPEC-1-002/C1 — catálogo de exames (exam_catalog): linhas importadas do
// insumo (tabela-particular-D), preservando raw e linha de origem. Leitura
// para autenticados; escrita NUNCA pela API do cliente (null) — importação
// só pela rota backend auditada. Nada sai ativo/aprovado pela importação.
// NOTA (0010): bool required:true nega o valor false no PocketBase — flags
// ficam required:false porque false é estado legítimo.
migrate(
  (app) => {
    const col = new Collection({
      name: 'exam_catalog',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'source_row', type: 'number', required: true, onlyInt: true },
        { name: 'code_raw', type: 'text', required: true, max: 200 },
        { name: 'code_normalized', type: 'text', required: true, max: 200 },
        { name: 'description', type: 'text', required: true, max: 500 },
        { name: 'price_raw_decimal', type: 'text', required: true, max: 50 },
        { name: 'currency', type: 'text', required: false, max: 10 },
        { name: 'price_approved', type: 'bool', required: false },
        { name: 'active', type: 'bool', required: false },
        { name: 'conflict', type: 'bool', required: false },
        { name: 'batch_scope', type: 'text', required: true, max: 50 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_exam_catalog_row ON exam_catalog (source_row, code_raw)',
        'CREATE INDEX idx_exam_catalog_key ON exam_catalog (code_normalized)',
        'CREATE INDEX idx_exam_catalog_conflict ON exam_catalog (conflict)',
      ],
    })
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('exam_catalog')
    app.delete(col)
  },
)
