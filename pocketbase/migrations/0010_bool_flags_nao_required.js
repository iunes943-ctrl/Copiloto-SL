// SPEC-1-002/C1 — correção: bool required:true nega o valor false no
// PocketBase ("Cannot be blank"). Flags do catálogo são estados legítimos em
// false — required sai. Down devolve required (reversão segura).
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('exam_catalog')
    for (const name of ['price_approved', 'active', 'conflict']) {
      const f = col.fields.getByName(name)
      f.required = false
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('exam_catalog')
    for (const name of ['price_approved', 'active', 'conflict']) {
      const f = col.fields.getByName(name)
      f.required = true
    }
    app.save(col)
  },
)
