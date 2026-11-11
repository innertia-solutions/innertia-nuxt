import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

const COMPONENTS = ['DriveBrowser', 'DriveFolderField', 'DriveImport', 'VersionHistory', 'ProviderOrigin']

describe('SFC de Files (Drive y versiones) compilan', () => {
  for (const name of COMPONENTS) {
    it(name, () => {
      const filename = resolve(__dirname, `../${name}.vue`)
      const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
      expect(errors).toEqual([])

      const script = compileScript(descriptor, { id: name })
      const tpl = compileTemplate({
        source: descriptor.template!.content,
        filename,
        id: name,
        compilerOptions: { bindingMetadata: script.bindings },
      })
      expect(tpl.errors).toEqual([])
    })
  }
})
