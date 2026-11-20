import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

// Billing components compile (script + template) without errors.
const COMPONENTS = [
  '../Plans.vue', '../Invoices.vue', '../SpaceSubscription.vue', '../ClientTotals.vue', '../Settings.vue', '../Overview.vue', '../StatusBanner.vue', '../UsageTable.vue',
  '../Adjustments.vue', '../CreditNoteForm.vue', '../ClientTerms.vue', '../AccountStatement.vue', '../ActivityLog.vue', '../Reconciliation.vue', '../Reports.vue',
]

describe('SFC de Billing compilan', () => {
  for (const rel of COMPONENTS) {
    it(rel, () => {
      const filename = resolve(__dirname, rel)
      const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
      expect(errors).toEqual([])

      const script = compileScript(descriptor, { id: rel })
      const tpl = compileTemplate({
        source: descriptor.template!.content,
        filename,
        id: rel,
        compilerOptions: { bindingMetadata: script.bindings },
      })
      expect(tpl.errors).toEqual([])
    })
  }
})
