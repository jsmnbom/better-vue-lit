import { EffectScope, ShallowReactive, effect, effectScope, shallowReactive } from '@vue/reactivity'
import { TemplateResult, render } from 'lit-html'
import { ComponentPropsOptions, ExtractPropTypes, PropFlags, normalizePropsOptions } from './props'
import { LooseRequired } from '@vue/shared';
import { EmitsOptions } from './emit';

interface ComponentOptions {
  name?: string
}

type RenderFunction = () => TemplateResult<any> | string

export type Prettify<T> = { [K in keyof T]: T[K] } & {}

type Hook = () => void

const hookNames = ['_bm', '_m', '_bu', '_u', '_um'] as const
type HookName = typeof hookNames[number]

interface BetterVueLitElement extends HTMLElement {
  _props: ShallowReactive<Record<string, any>>
  _hooks: Map<HookName, Set<Hook>>
}

let currentInstance: BetterVueLitElement | null = null

export function defineComponent<
  PropsOptions extends ComponentPropsOptions,
  Props = Readonly<ExtractPropTypes<PropsOptions>>,
  E extends EmitsOptions = {},
>(
  setup: (
    props: Prettify<LooseRequired<Props>>,
    // ctx: SetupContext<E, S>
  ) => RenderFunction,
  options?: ComponentOptions & {
    props?: PropsOptions,
    emits?: E
  }
): CustomElementConstructor {
  options = options || {}
  options.props = options.props || {} as PropsOptions

  const normalized = normalizePropsOptions(options.props)
  const observedAttributes = Object.entries(normalized).filter(([_k, v]) => v && v[PropFlags.attribute]).map(([k]) => k)
  const element = class extends HTMLElement implements BetterVueLitElement {
    _scope: EffectScope
    _props: ShallowReactive<Props>
    _hooks = new Map<HookName, Set<Hook>>()

    static get observedAttributes() {
      console.log('observedAttributes', observedAttributes)
      return observedAttributes
    }

    constructor() {
      super()

      hookNames.forEach((name) => {
        this._hooks.set(name, new Set())
      })

      this._props = shallowReactive({}) as ShallowReactive<Props>
      this._scope = effectScope()

      let template: RenderFunction
      this._scope.run(() => {
        currentInstance = this
        template = setup.call(this, this._props)
        currentInstance = null
      })

      this._runHooks('_bm')
      const root = this.attachShadow({ mode: 'closed' })
      let isMounted = false

      effect(() => {
        if (isMounted) {
          this._runHooks('_bu')
        }
        render(template(), root)
        if (isMounted) {
          this._runHooks('_u')
        } else {
          isMounted = true
        }
      }, {
        scope: this._scope
      })
    }
    connectedCallback() {
      this._runHooks('_m')
    }
    disconnectedCallback() {
      this._runHooks('_um')
      this._scope.stop()
    }
    attributeChangedCallback(name: keyof Props, _oldValue: any, newValue: any) {
      this._props[name] = newValue
    }

    _runHooks(name: HookName) {
      this._hooks.get(name)?.forEach((cb) => cb())
    }
  }
  return element
}

function createLifecycleMethod(name: HookName) {
  return (cb: () => void) => {
    if (currentInstance) {
      (currentInstance._hooks.get(name))?.add(cb)
    }
    return () => {
      if (currentInstance) {
        (currentInstance._hooks.get(name))?.delete(cb)
      }
    }
  }
}

export const onBeforeMount = createLifecycleMethod('_bm')
export const onMounted = createLifecycleMethod('_m')
export const onBeforeUpdate = createLifecycleMethod('_bu')
export const onUpdated = createLifecycleMethod('_u')
export const onUnmounted = createLifecycleMethod('_um')