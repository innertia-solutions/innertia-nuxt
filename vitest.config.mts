import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [clientOnlyVue()],
  test: {
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    environment: 'node',
  },
})

/**
 * plugin-vue para importar SFC en tests. En entorno node vitest los transforma
 * en modo SSR (solo ssrRender); aquí se fuerza la compilación cliente para
 * poder montarlos con un renderer propio.
 */
function clientOnlyVue() {
  const plugin = vue()
  const transform = plugin.transform as any
  const load = plugin.load as any
  return {
    ...plugin,
    load(this: any, id: string, opts?: any) {
      return load?.call(this, id, { ...opts, ssr: false })
    },
    transform(this: any, code: string, id: string, opts?: any) {
      return transform.call(this, code, id, { ...opts, ssr: false })
    },
  }
}
