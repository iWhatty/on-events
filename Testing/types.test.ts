import { on, off, On, type Stop, type OnChain } from '../src/on-events.js'

const button = document.createElement('button')
const click: Stop = On.click(button, (event) => { const mouse: MouseEvent = event })
const chain: OnChain = On.capture.passive
chain.scroll(button, (event) => { const generic: Event = event })
On.group().capture.passive.delegate.click(document, 'button', function (event) {
  const target: Element = this
  const mouse: MouseEvent = event
})
On.delegate.first.capture.passive.event('panel:open')(document, 'button', function (event) {
  const target: Element = this
  const generic: Event = event
})
On.capture.event('capture')(button, () => {})
On.event<CustomEvent<{ id: number }>>('panel:open')(button, (event) => {
  const id: number = event.detail.id
})
On.delegate.event('click')(document, 'button', (event) => { const mouse: MouseEvent = event })
const ready: Stop = On.group().ready(() => {})
const group = On.group()
const same: Stop = group.add(click)
const empty: null = group.add(null)
group.add(undefined)
group.add(false)
group.stop()
On.delegate.capture.batch(document, { click: () => {}, event: ['button', function () { const target: Element = this }] })
on(button, 'click', () => {}, true)
on(document, 'click', 'button', function () { const target: Element = this }, { once: true })
off(button, 'click', () => {})

// @ts-expect-error The fluent surface is not callable.
On(button, () => {})
// @ts-expect-error Modifiers follow the same object-only shape.
On.capture(button, () => {})
// @ts-expect-error Event binders do not expose fluent modifiers.
On.click.capture.click(button, () => {})
// @ts-expect-error Direct binders do not accept a delegated signature.
On.click(document, 'button', () => {})
// @ts-expect-error Delegated binders require a selector.
On.delegate.click(button, () => {})
// @ts-expect-error The group factory exists only on On itself.
On.capture.group()
// @ts-expect-error Groups do not expose a nested group factory.
On.group().group()
// @ts-expect-error Group controls exist only on the group root.
On.group().capture.stop()
// @ts-expect-error A click event is not a keyboard event.
On.capture.click(button, (event: KeyboardEvent) => {})
// @ts-expect-error Custom event binders are leaf functions.
On.event('panel:open').passive
