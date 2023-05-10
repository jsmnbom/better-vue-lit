import {  isFunction, type IfAny, isObject, EMPTY_ARR, isArray, camelize, makeMap } from "@vue/shared"

export type Data = Record<string, unknown>

export type ComponentPropsOptions<P = Data> =
  | ComponentObjectPropsOptions<P>
  | string[]

export type ComponentObjectPropsOptions<P = Data> = {
  [K in keyof P]: Prop<P[K]> | null
}

export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>

type DefaultFactory<T> = (props: Data) => T | null | undefined

export interface PropOptions<T = any, D = T> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: D | DefaultFactory<D> | null | undefined | object
  validator?(value: unknown): boolean
}

export type PropType<T> = PropConstructor<T> | PropConstructor<T>[]

type PropConstructor<T = any> =
  | { new(...args: any[]): T & {} }
  | { (): T }
  | PropMethod<T>

type PropMethod<T, TConstructor = any> = [T] extends [
  ((...args: any) => any) | undefined
] // if is function with args, allowing non-required functions
  ? { new(): TConstructor; (): T; readonly prototype: TConstructor } // Create Function like constructor
  : never

type RequiredKeys<T> = {
  [K in keyof T]: T[K] extends
  | { required: true }
  | { default: any }
  // don't mark Boolean props as undefined
  | BooleanConstructor
  | { type: BooleanConstructor }
  ? T[K] extends { default: undefined | (() => undefined) }
  ? never
  : K
  : never
}[keyof T]

type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>

type DefaultKeys<T> = {
  [K in keyof T]: T[K] extends
  | { default: any }
  // Boolean implicitly defaults to false
  | BooleanConstructor
  | { type: BooleanConstructor }
  ? T[K] extends { type: BooleanConstructor; required: true } // not default if Boolean is marked as required
  ? never
  : K
  : never
}[keyof T]

type InferPropType<T> = [T] extends [null]
  ? any // null & true would fail to infer
  : [T] extends [{ type: null | true }]
  ? any // As TS issue https://github.com/Microsoft/TypeScript/issues/14829 // somehow `ObjectConstructor` when inferred from { (): T } becomes `any` // `BooleanConstructor` when inferred from PropConstructor(with PropMethod) becomes `Boolean`
  : [T] extends [ObjectConstructor | { type: ObjectConstructor }]
  ? Record<string, any>
  : [T] extends [BooleanConstructor | { type: BooleanConstructor }]
  ? boolean
  : [T] extends [DateConstructor | { type: DateConstructor }]
  ? Date
  : [T] extends [(infer U)[] | { type: (infer U)[] }]
  ? U extends DateConstructor
  ? Date | InferPropType<U>
  : InferPropType<U>
  : [T] extends [Prop<infer V, infer D>]
  ? unknown extends V
  ? IfAny<V, V, D>
  : V
  : T

/**
 * Extract prop types from a runtime props options object.
 * The extracted types are **internal** - i.e. the resolved props received by
 * the component.
 * - Boolean props are always present
 * - Props with default values are always present
 *
 * To extract accepted props from the parent, use {@link ExtractPublicPropTypes}.
 */
export type ExtractPropTypes<O> = {
  // use `keyof Pick<O, RequiredKeys<O>>` instead of `RequiredKeys<O>` to
  // support IDE features
  [K in keyof Pick<O, RequiredKeys<O>>]: InferPropType<O[K]>
} & {
    // use `keyof Pick<O, OptionalKeys<O>>` instead of `OptionalKeys<O>` to
    // support IDE features
    [K in keyof Pick<O, OptionalKeys<O>>]?: InferPropType<O[K]>
  }

type PublicRequiredKeys<T> = {
  [K in keyof T]: T[K] extends { required: true } ? K : never
}[keyof T]

type PublicOptionalKeys<T> = Exclude<keyof T, PublicRequiredKeys<T>>

/**
 * Extract prop types from a runtime props options object.
 * The extracted types are **public** - i.e. the expected props that can be
 * passed to component.
 */
export type ExtractPublicPropTypes<O> = {
  [K in keyof Pick<O, PublicRequiredKeys<O>>]: InferPropType<O[K]>
} & {
    [K in keyof Pick<O, PublicOptionalKeys<O>>]?: InferPropType<O[K]>
  }

export const enum PropFlags {
  shouldCastBoolean,
  shouldCastTrue,
  attribute,
}

// extract props which defined with default from prop options
export type ExtractDefaultPropTypes<O> = O extends object
  ? // use `keyof Pick<O, DefaultKeys<O>>` instead of `DefaultKeys<O>` to support IDE features
  { [K in keyof Pick<O, DefaultKeys<O>>]: InferPropType<O[K]> }
  : {}

export type NormalizedProp =
  | null
  | (PropOptions & {
    [PropFlags.shouldCastBoolean]?: boolean
    [PropFlags.shouldCastTrue]?: boolean
    [PropFlags.attribute]?: boolean
  })

// normalized value is a tuple of the actual normalized options
// and an array of prop keys that need value casting (booleans and defaults)
export type NormalizedProps = Record<string, NormalizedProp>
export type NormalizedPropsOptions = NormalizedProps

// function resolvePropValue(
//   options: NormalizedProps,
//   props: Data,
//   key: string,
//   value: unknown,
//   // instance: ComponentInternalInstance,
//   isAbsent: boolean
// ) {
//   const opt = options[key]
//   if (opt != null) {
//     const hasDefault = hasOwn(opt, 'default')
//     // default values
//     if (hasDefault && value === undefined) {
//       const defaultValue = opt.default
//       if (
//         opt.type !== Function &&
//         isFunction(defaultValue)
//       ) {
//         // const { propsDefaults } = instance
//         // if (key in propsDefaults) {
//         //   value = propsDefaults[key]
//         // } else {
//         //   // setCurrentInstance(instance)
//         //   value = propsDefaults[key] = defaultValue.call(
//         //     props
//         //   )
//         //   // unsetCurrentInstance()
//         // }
//       } else {
//         value = defaultValue
//       }
//     }
//     // boolean casting
//     if (opt[BooleanFlags.shouldCast]) {
//       if (isAbsent && !hasDefault) {
//         value = false
//       } else if (
//         opt[BooleanFlags.shouldCastTrue] &&
//         (value === '' || value === hyphenate(key))
//       ) {
//         value = true
//       }
//     }
//   }
//   return value
// }

// export function normalizePropsOptions(
//   comp: ConcreteComponent,
//   appContext: AppContext,
//   asMixin = false
// ): NormalizedPropsOptions {

//   const raw = comp.props
//   const normalized: NormalizedPropsOptions[0] = {}
//   const needCastKeys: NormalizedPropsOptions[1] = []

//   // apply mixin/extends props
//   let hasExtends = false

//   if (!raw && !hasExtends) {
//     return EMPTY_ARR as any
//   }

//   if (isArray(raw)) {
//     for (let i = 0; i < raw.length; i++) {
//       // if (__DEV__ && !isString(raw[i])) {
//       //   warn(`props must be strings when using array syntax.`, raw[i])
//       // }
//       const normalizedKey = camelize(raw[i])
//       if (validatePropName(normalizedKey)) {
//         normalized[normalizedKey] = EMPTY_OBJ
//       }
//     }
//   } else if (raw) {
//     // if (__DEV__ && !isObject(raw)) {
//     //   warn(`invalid props options`, raw)
//     // }
//     for (const key in raw) {
//       const normalizedKey = camelize(key)
//       if (validatePropName(normalizedKey)) {
//         const opt = raw[key]
//         const prop: NormalizedProp = (normalized[normalizedKey] =
//           isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt))
//         if (prop) {
//           const booleanIndex = getTypeIndex(Boolean, prop.type)
//           const stringIndex = getTypeIndex(String, prop.type)
//           prop[BooleanFlags.shouldCast] = booleanIndex > -1
//           prop[BooleanFlags.shouldCastTrue] =
//             stringIndex < 0 || booleanIndex < stringIndex
//           // if the prop needs boolean casting or default value
//           if (booleanIndex > -1 || hasOwn(prop, 'default')) {
//             needCastKeys.push(normalizedKey)
//           }
//         }
//       }
//     }
//   }

//   const res: NormalizedPropsOptions = [normalized, needCastKeys]
//   // if (isObject(comp)) {
//   //   cache.set(comp, res)
//   // }
//   return res
// }

// use function string name to check type constructors
// so that it works across vms / iframes.
function getType(ctor: Prop<any>): string {
  const match = ctor && ctor.toString().match(/^\s*(function|class) (\w+)/)
  return match ? match[2] : ctor === null ? 'null' : ''
}

// function isSameType(a: Prop<any>, b: Prop<any>): boolean {
//   return getType(a) === getType(b)
// }

const isAttributeType = /*#__PURE__*/ makeMap(
  'String,Number,Boolean'
)

export function normalizePropsOptions(props: ComponentPropsOptions): NormalizedPropsOptions {
  if (isArray(props)) {
    const normalized: NormalizedProps = {}
    for (let i = 0; i < props.length; i++) {
      // if (__DEV__ && !isString(props[i])) {
      //   warn(`props must be strings when using array syntax.`, props[i])
      // }
      const key = camelize(props[i])
      normalized[key] = {
        type: null,
        [PropFlags.attribute]: true,
      }
    }
    return normalized
  } else if (props == null) {
    return EMPTY_ARR as any
  } else if (isObject(props)) {
    const normalized: NormalizedProps = {}
    for (const key in props) {
      const opt = props[key]
      const prop: NormalizedProp = (normalized[camelize(key)] = isArray(opt) || isFunction(opt) ? { type: opt } : opt)
      if (prop) {
        console.log('prop', prop, getType(prop.type as any))
        prop[PropFlags.attribute] = isAttributeType(getType(prop.type as any))
      }
      // const prop: NormalizedProp = (normalized[camelize(key)] = isArray(opt) || isFunction(opt) ? { type: opt } : opt)
      // if (prop) {
      //   const booleanIndex = getTypeIndex(Boolean, prop.type)
      //   const stringIndex = getTypeIndex(String, prop.type)
      //   prop[PropFlags.shouldCastBoolean] = booleanIndex > -1
      //   prop[PropFlags.shouldCastTrue] = stringIndex < 0 || booleanIndex < stringIndex
      //   console.log(getType(prop), prop, opt)
      // }
    }
    console.log('normalized', normalized)
    return normalized
  }
  // else if (__DEV__) {
  //   warn(`invalid props options`, props)
  // }
  return EMPTY_ARR as any
}

// function getObservedAttributes(props: NormalizedProps): string[] {
//   props
//   const res: string[] = []
//   for (const key in props) {
//     if (props[key]?[PropFlags.attribute]) {
//       res.push(hyphenate(key))
//     }
//   }
//   return res
// }


// function getTypeIndex(
//   type: Prop<any>,
//   expectedTypes: PropType<any> | void | null | true
// ): number {
//   if (isArray(expectedTypes)) {
//     return expectedTypes.findIndex(t => isSameType(t, type))
//   } else if (isFunction(expectedTypes)) {
//     return isSameType(expectedTypes, type) ? 0 : -1
//   }
//   return -1
// }
