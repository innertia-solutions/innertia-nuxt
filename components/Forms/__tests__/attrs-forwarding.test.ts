import { describe, it, expect, vi } from 'vitest'
import { createRenderer, h, nextTick, ref } from 'vue'
import Input from '../Input.vue'
import CurrencyInput from '../CurrencyInput.vue'

/*
 * Renderer mínimo (sin DOM): cada nodo guarda su tag y los props/listeners que
 * Vue le aplica. Basta para verificar a qué elemento llegan los $attrs.
 */
type TestNode = {
  tag: string
  props: Record<string, any>
  children: TestNode[]
  parent: TestNode | null
  text?: string
  value?: any
  /** vModelText registra listeners nativos; aquí basta con aceptarlos. */
  addEventListener: () => void
}

function makeNode(tag: string): TestNode {
  return { tag, props: {}, children: [], parent: null, addEventListener: () => {} }
}

function remove(child: TestNode) {
  const p = child.parent
  if (!p) return
  const i = p.children.indexOf(child)
  if (i > -1) p.children.splice(i, 1)
  child.parent = null
}

const { createApp } = createRenderer<TestNode, TestNode>({
  createElement: tag => makeNode(tag),
  createText: text => ({ ...makeNode('#text'), text }),
  createComment: text => ({ ...makeNode('#comment'), text }),
  setText: (node, text) => { node.text = text },
  setElementText: (node, text) => { node.children = []; node.text = text },
  insert: (child, parent, anchor) => {
    remove(child)
    const i = anchor ? parent.children.indexOf(anchor) : -1
    if (i > -1) parent.children.splice(i, 0, child)
    else parent.children.push(child)
    child.parent = parent
  },
  remove,
  parentNode: node => node.parent,
  nextSibling: (node) => {
    const p = node.parent
    if (!p) return null
    return p.children[p.children.indexOf(node) + 1] ?? null
  },
  patchProp: (el, key, _prev, next) => {
    if (next == null) delete el.props[key]
    else el.props[key] = next
  },
})

function find(node: TestNode, tag: string): TestNode | undefined {
  if (node.tag === tag) return node
  for (const c of node.children) {
    const hit = find(c, tag)
    if (hit) return hit
  }
}

/**
/** Sin DOM ni SSR: monta la app sobre el renderer de prueba. */
function mountApp(render: () => any, root: TestNode) {
  createApp({ render }).mount(root)
}

function mount(component: any, props: Record<string, any>) {
  const root = makeNode('root')
  mountApp(() => h(component, props), root)
  const wrapper = root.children.find(c => c.tag === 'div')!
  const input = find(root, 'input')!
  return { root, wrapper, input }
}

/** Vue puede guardar un listener como función o como array (merge de listeners). */
function call(listener: any, ...args: any[]) {
  if (Array.isArray(listener)) listener.forEach(fn => fn(...args))
  else listener(...args)
}

describe('Forms.Input reenvía $attrs al <input>', () => {
  it('pone maxlength/required/inputmode en el input y no en el div raíz', () => {
    const { wrapper, input } = mount(Input, { maxlength: 20, required: true, inputmode: 'numeric', name: 'code' })
    expect(input.props.maxlength).toBe(20)
    expect(input.props.required).toBe(true)
    expect(input.props.inputmode).toBe('numeric')
    expect(input.props.name).toBe('code')
    expect(wrapper.props.maxlength).toBeUndefined()
  })

  it('ejecuta @blur y @keydown del consumidor sobre el input', () => {
    const onBlur = vi.fn()
    const onKeydown = vi.fn()
    const { wrapper, input } = mount(Input, { onBlur, onKeydown })
    expect(wrapper.props.onBlur).toBeUndefined()
    call(input.props.onBlur, { type: 'blur' })
    call(input.props.onKeydown, { type: 'keydown' })
    expect(onBlur).toHaveBeenCalledOnce()
    expect(onKeydown).toHaveBeenCalledOnce()
  })

  it('mantiene class y style en el div raíz', () => {
    const { wrapper, input } = mount(Input, { class: 'col-span-2', style: { width: '10px' } })
    expect(wrapper.props.class).toContain('col-span-2')
    expect(wrapper.props.class).toContain('w-full')
    expect(wrapper.props.style).toMatchObject({ width: '10px' })
    expect(input.props.class).not.toContain('col-span-2')
    expect(input.props.style).toBeUndefined()
  })

  it('actualiza los attrs reenviados cuando cambian', async () => {
    const max = ref(10)
    const root = makeNode('root')
    mountApp(() => h(Input, { maxlength: max.value }), root)
    expect(find(root, 'input')!.props.maxlength).toBe(10)
    max.value = 30
    await nextTick()
    expect(find(root, 'input')!.props.maxlength).toBe(30)
  })
})

describe('Forms.CurrencyInput reenvía $attrs al <input>', () => {
  it('combina el @blur del consumidor con el blur interno', () => {
    const onBlur = vi.fn()
    const { wrapper, input } = mount(CurrencyInput, { onBlur, maxlength: 15, class: 'mb-2' })
    expect(input.props.maxlength).toBe(15)
    expect(wrapper.props.class).toContain('mb-2')
    call(input.props.onBlur, { type: 'blur' })
    expect(onBlur).toHaveBeenCalledOnce()
  })
})
