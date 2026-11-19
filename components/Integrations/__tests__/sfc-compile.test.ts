import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

// Integrations components (API keys, webhooks, API reference) compile (script + template) without errors.
const COMPONENTS = ['../ApiKeys.vue', '../Webhooks.vue', '../Developers.vue']

describe('SFC de integraciones compilan', () => {
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

  it('Developers pins the Scalar CDN build', () => {
    const src = readFileSync(resolve(__dirname, '../Developers.vue'), 'utf8')
    expect(src).toContain('https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.4/dist/browser/standalone.js')
  })
})
