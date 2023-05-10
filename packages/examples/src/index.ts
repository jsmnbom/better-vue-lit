import {
  defineComponent,
  onMounted,
  onUpdated,
  onUnmounted,
} from 'better-vue-lit'
import { reactive, ref } from '@vue/reactivity'
import { watch } from '@vue-reactivity/watch'
import { html } from 'lit-html'
import { PropType } from 'node_modules/better-vue-lit/dist/props'

customElements.define('my-component', defineComponent((props) => {
  console.log(props)

  const state = reactive({
    text: 'hello',
    show: true
  })
  const toggle = () => {
    state.show = !state.show
  }
  const onInput = (e: InputEvent) => {
    state.text = (e.target as HTMLInputElement).value
  }

  return () => html`
      <button @click=${toggle}>toggle child</button>
      <p>
      ${state.text} <input value=${state.text} @input=${onInput}>
      </p>
      ${state.show ? html`<my-child .state=${state}></my-child>` : ``}
    `
}, { name: 'my-component', props: ['test'] }))

customElements.define('my-child', defineComponent((props) => {
  console.log(this)

  console.log(props)

  const count = ref(0)
  const increase = () => {
    count.value++
  }

  watch(count, (count) => {
    console.log(`Count: ${count}`)
  })

  onMounted(() => {
    console.log('child mounted')
  })

  onUpdated(() => {
    console.log('child updated')
  })

  onUnmounted(() => {
    console.log('child unmounted')
  })

  return () => html`
      <p>${props.state}</p>
      <p>${count.value}</p>
      <button @click=${increase}>increase</button>
    `
}, { name: 'my-child', props: {
  state: {
    type: Object as PropType<{ text: string, show: boolean }>,
  },
  msg: {
    type: String,
    default: 'hello'
  }
} }))