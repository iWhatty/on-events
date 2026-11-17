import { on, off, On } from 'on-events'

// This entire consumer is bundled and compiled, including the fluent accesses.
const passed = []
function check(condition, label) {
  if (!condition) throw new Error(label)
  passed.push(label)
}
const root = document.createElement('div')
const button = document.createElement('button')
const child = document.createElement('span')
const miss = document.createElement('i')
button.append(child)
root.append(button, miss)
document.body.append(root)
const fire = (target, type) => target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))

const group = On.group()
let direct = 0
const stopDirect = group.capture.passive.pointerdown(root, event => {
  direct++
  event.preventDefault()
})
check(fire(child, 'pointerdown'), 'passive observer preserves default action')
check(direct === 1, 'fluent event name and two modifiers survive')
stopDirect()
fire(child, 'pointerdown')
check(direct === 1, 'individual fluent stop removes listener')

let delegated = 0
group.first.capture.passive.delegate.click(root, 'button', function(event, matched) {
  delegated++
  check(this === button && matched === button && event.target === child, 'delegated context and matched argument survive')
  fire(child, 'click')
})
fire(miss, 'click')
check(delegated === 0, 'delegated once survives a miss')
fire(child, 'click')
check(delegated === 1, 'delegated once removes before reentrant dispatch')

let once = 0
group.once.keydown(root, () => once++)
fire(child, 'keydown')
fire(child, 'keydown')
check(once === 1, 'once alias survives')

let custom = 0
group.capture.event('applicationDone')(root, () => custom++)
fire(child, 'applicationDone')
check(custom === 1, 'explicit custom event survives')
let batch = 0
group.capture.passive.batch(root, { pointerdown: () => batch++, 'app:done': ['button', () => batch++] })
fire(child, 'pointerdown')
fire(child, 'app:done')
check(batch === 2, 'standard and custom delegated batch keys survive')

let hover = 0
group.hover(button, () => hover++, () => hover++)
fire(button, 'mouseenter')
fire(button, 'mouseleave')
check(hover === 2, 'hover helper survives')
Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' })
let ready = 0
const cancelReady = group.ready(() => ready++)
cancelReady()
fire(document, 'DOMContentLoaded')
check(ready === 0, 'pending ready cancellation survives')
group.ready(() => ready++)
fire(document, 'DOMContentLoaded')
fire(document, 'DOMContentLoaded')
check(ready === 1, 'ready fires once')
Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' })
group.ready(() => ready++)
check(ready === 2, 'already-ready callback survives')

let cleanups = 0
const raw = () => cleanups++
check(group.add(raw) === raw && group.add(raw) === raw && group.add(null) === null, 'add preserves identity and nullish inputs')
const finish = group.defer(() => cleanups++)
finish()
finish()
check(cleanups === 1, 'defer completes once')
group.stop()
group.stop()
check(cleanups === 2, 'group stop deduplicates raw cleanup')
fire(child, 'applicationDone')
fire(child, 'pointerdown')
fire(child, 'app:done')
fire(button, 'mouseenter')
check(custom === 1 && batch === 2 && hover === 2, 'group removes remaining listeners across targets')
const oldStop = group.stop
const fresh = On.group()
fresh.capture.pointerdown(root, () => direct++)
oldStop()
fire(child, 'pointerdown')
fresh.stop()
check(direct === 2, 'old scope cannot stop fresh scope')

let classic = 0
const handler = () => classic++
on(root, 'pointerdown', handler, { capture: true, passive: false })
on(root, 'pointerdown', handler)
off(root, 'pointerdown', handler)
fire(child, 'pointerdown')
check(classic === 0, 'classic off removes both capture modes')
const abort = new AbortController()
on(root, 'pointerdown', handler, { signal: abort.signal })
abort.abort()
fire(child, 'pointerdown')
check(classic === 0, 'native option keys and abort survive')

// A real mangling pass must still rename application-private properties.
const application = { tick_: 1 }
check(application.tick_ === 1, 'application property mangling remains enabled')
// STANDARD_EVENT_CHECKS
root.remove()
console.log(JSON.stringify(passed))
