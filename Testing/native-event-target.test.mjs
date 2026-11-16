// Run with node --test after building dist. No DOM shim or test framework dependencies.
import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import test from 'node:test'
import * as source from '../src/on-events.js'
import * as minified from '../dist/on-events.min.js'

console.log(`Native EventTarget contract on ${process.version}`)

for (const [entry, { on, off, On }] of [['source', source], ['minified', minified]]) {
  for (const capture of [false, true]) {
    const name = `${entry}, capture=${capture}`
    const dispatch = (target) => target.dispatchEvent(new Event('probe'))

    test(`${name}: individual stop removes the actual listener`, () => {
      const target = new EventTarget()
      let calls = 0
      const stop = on(target, 'probe', () => calls++, capture)
      dispatch(target)
      stop()
      stop()
      assert.equal(getEventListeners(target, 'probe').length, 0)
      dispatch(target)
      assert.equal(calls, 1)
    })

    test(`${name}: group stop removes the actual listener`, () => {
      const target = new EventTarget()
      const group = On.group()
      let calls = 0
      const chain = capture ? group.capture.passive : group.passive
      chain.event('probe')(target, () => calls++)
      dispatch(target)
      group.stop()
      group.stop()
      assert.equal(getEventListeners(target, 'probe').length, 0)
      dispatch(target)
      assert.equal(calls, 1)
    })

    test(`${name}: off removes the actual listener`, () => {
      const target = new EventTarget()
      let calls = 0
      const handler = () => calls++
      const stop = on(target, 'probe', handler, { capture })
      dispatch(target)
      off(target, 'probe', handler)
      assert.equal(getEventListeners(target, 'probe').length, 0)
      dispatch(target)
      stop()
      assert.equal(calls, 1)
    })

    test(`${name}: once removes before the callback and reentrant dispatch`, () => {
      const target = new EventTarget()
      let calls = 0
      let remaining
      const chain = capture ? On.capture.first : On.first
      const stop = chain.event('probe')(target, () => {
        calls++
        remaining = getEventListeners(target, 'probe').length
        if (calls === 1) dispatch(target)
      })
      dispatch(target)
      dispatch(target)
      stop()
      assert.equal(calls, 1)
      assert.equal(remaining, 0)
      assert.equal(getEventListeners(target, 'probe').length, 0)
    })

    test(`${name}: abort releases the listener and tolerates subsequent cleanup`, () => {
      const target = new EventTarget()
      const controller = new AbortController()
      const group = On.group()
      let calls = 0
      const handler = () => calls++
      const stop = group.add(on(target, 'probe', handler, { capture, signal: controller.signal }))
      dispatch(target)
      controller.abort()
      assert.equal(getEventListeners(target, 'probe').length, 0)
      dispatch(target)
      stop()
      off(target, 'probe', handler)
      group.stop()
      assert.equal(calls, 1)
    })

    test(`${name}: already-aborted signals create no listener`, () => {
      const target = new EventTarget()
      const controller = new AbortController()
      controller.abort()
      let calls = 0
      const stop = on(target, 'probe', () => calls++, { capture, signal: controller.signal })
      assert.equal(getEventListeners(target, 'probe').length, 0)
      dispatch(target)
      stop()
      assert.equal(calls, 0)
    })

    test(`${name}: stale stops cannot remove a replacement registration`, () => {
      const target = new EventTarget()
      let calls = 0
      const handler = () => calls++
      const oldStop = on(target, 'probe', handler, { capture })
      oldStop()
      const nextStop = on(target, 'probe', handler, { capture })
      oldStop()
      assert.equal(getEventListeners(target, 'probe').length, 1)
      dispatch(target)
      nextStop()
      assert.equal(getEventListeners(target, 'probe').length, 0)
      assert.equal(calls, 1)
    })

    test(`${name}: direct callbacks retain native context and one argument`, () => {
      const target = new EventTarget()
      let received, context
      const stop = on(target, 'probe', function (...args) { received = args; context = this }, { capture })
      const event = new Event('probe')
      target.dispatchEvent(event)
      stop()
      assert.equal(context, target)
      assert.deepEqual(received, [event])
    })
  }

  test(`${entry}: stopping a capture group preserves the other group`, () => {
    const target = new EventTarget()
    const capturing = On.group()
    const normal = On.group()
    let calls = 0
    const handler = () => calls++
    capturing.capture.event('probe')(target, handler)
    normal.event('probe')(target, handler)
    capturing.stop()
    assert.equal(getEventListeners(target, 'probe').length, 1)
    target.dispatchEvent(new Event('probe'))
    normal.stop()
    assert.equal(getEventListeners(target, 'probe').length, 0)
    assert.equal(calls, 1)
  })

  test(`${entry}: explicit off removes matching registrations across capture modes`, () => {
    const target = new EventTarget()
    const handler = () => {}
    on(target, 'probe', handler, { capture: true })
    on(target, 'probe', handler, { capture: false })
    assert.equal(getEventListeners(target, 'probe').length, 2)
    off(target, 'probe', handler)
    assert.equal(getEventListeners(target, 'probe').length, 0)
  })
}
