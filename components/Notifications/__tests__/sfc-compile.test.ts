import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

// Componentes de avisos, correo y marca: compilan (script + template) sin errores.
const COMPONENTS = [
  '../Preferences.vue',
  '../../Platform/Emails.vue',
  '../../Platform/MailSettings.vue',
  '../../Mail/BrandingPreview.vue',
  '../../Mail/BrandingSettings.vue',
  '../../App/NotificationBell.vue',
  '../../App/NotificationHistory.vue',
]

describe('SFC de avisos y correo compilan', () => {
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
