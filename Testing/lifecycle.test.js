import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { on, off, On } from '../src/on-events.js'

describe('listener lifecycle regressions', () => {
  let root, button

  beforeEach(() => {
    root = document.createElement('div')
    button = document.createElement('button')
    button.textContent = 'Click'
    root.append(button)
    document.body.append(root)
  })

  afterEach(() => {
    root.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each(['stop', 'off'])('removes boolean capture listeners through %s', (method) => {
    const fn = vi.fn()
    const stop = on(button, 'click', fn, true)
    if (method === 'stop') stop()
    else off(button, 'click', fn)
    button.click()
    expect(fn).not.toHaveBeenCalled()
  })

  it('removes delegated listeners registered with boolean capture', () => {
    const fn = vi.fn()
    const stop = on(root, 'click', 'button', fn, true)
    stop()
    button.click()
    expect(fn).not.toHaveBeenCalled()
  })

  it('snapshots inherited options and preserves explicit passive behavior', () => {
    const options = Object.create({ capture: true, passive: true, once: true })
    const fn = vi.fn((event) => event.preventDefault())
    const stop = on(root, 'scroll', fn, options)
    options.capture = false
    options.once = false
    const event = new Event('scroll', { cancelable: true })
    button.dispatchEvent(event)
    button.dispatchEvent(new Event('scroll'))
    stop()
    expect(fn).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(false)
  })

  it.each([false, true])('isolates groups sharing callbacks (second capture=%s)', (capture) => {
    const fn = vi.fn()
    const a = On.group()
    const b = On.group()
    a.click(button, fn)
    if (capture) b.capture.click(button, fn)
    else b.click(button, fn)

    button.click()
    expect(fn).toHaveBeenCalledTimes(2)
    a.stop()
    button.click()
    expect(fn).toHaveBeenCalledTimes(3)
    b.stop()
    button.click()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('isolates delegated registrations sharing a callback and selector', () => {
    const fn = vi.fn()
    const a = On.group()
    const b = On.group()
    a.delegate.click(root, 'button', fn)
    b.delegate.click(root, 'button', fn)
    a.stop()
    button.click()
    b.stop()
    expect(fn).toHaveBeenCalledOnce()
  })

  it.each(['stop', 'off', 'once', 'abort'])('keeps expired %s handles from removing new bindings', (expiry) => {
    const fn = vi.fn()
    const controller = new AbortController()
    const options = expiry === 'once' ? { once: true } : { signal: controller.signal }
    const oldStop = on(button, 'click', fn, options)
    if (expiry === 'stop') oldStop()
    if (expiry === 'off') off(button, 'click', fn)
    if (expiry === 'once') button.click()
    if (expiry === 'abort') controller.abort()
    fn.mockClear()

    const newStop = On.click(button, fn)
    oldStop()
    button.click()
    newStop()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('off still removes all matching registrations without removing other selectors', () => {
    const fn = vi.fn()
    on(root, 'click', fn)
    on(root, 'click', fn, true)
    const stopDelegated = on(root, 'click', 'button', fn)
    off(root, 'click', fn)
    button.click()
    expect(fn).toHaveBeenCalledOnce()
    off(root, 'click', fn, 'button')
    button.click()
    stopDelegated()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('preserves direct handler context and event identity', () => {
    const event = new Event('click')
    const fn = vi.fn(function (received) {
      expect(this).toBe(button)
      expect(received).toBe(event)
      expect(received.currentTarget).toBe(button)
    })
    const stop = On.click(button, fn)
    button.dispatchEvent(event)
    stop()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('cleans up custom events after multiple modifiers', () => {
    const group = On.group()
    const fn = vi.fn()
    group.capture.passive.event('panel:open')(button, fn)
    button.dispatchEvent(new Event('panel:open'))
    expect(fn).toHaveBeenCalledOnce()
    expect(() => group.stop()).not.toThrow()
    button.dispatchEvent(new Event('panel:open'))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('cleans up delegated custom events after multiple modifiers', () => {
    const group = On.group()
    const fn = vi.fn()
    group.capture.passive.delegate.event('panel:open')(root, 'button', fn)
    button.dispatchEvent(new Event('panel:open', { bubbles: true }))
    expect(fn).toHaveBeenCalledOnce()
    expect(() => group.stop()).not.toThrow()
    button.dispatchEvent(new Event('panel:open', { bubbles: true }))
    expect(fn).toHaveBeenCalledOnce()
  })

  it.each(['capture', 'delegate', 'once', 'event', 'ready', 'batch', 'hover', 'group', 'add', 'defer', 'stop'])('binds the explicit event name %s', (type) => {
    const fn = vi.fn()
    const group = On.group()
    group.capture.passive.event(type)(button, fn)
    button.dispatchEvent(new Event(type))
    expect(fn).toHaveBeenCalledOnce()
    group.stop()
    button.dispatchEvent(new Event(type))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('binds helper names in a mixed direct and delegated batch', () => {
    const direct = vi.fn()
    const delegated = vi.fn()
    const group = On.group()
    group.capture.passive.batch(root, { capture: direct, event: ['button', delegated] })
    const dispatch = () => {
      button.dispatchEvent(new Event('capture', { bubbles: true }))
      button.dispatchEvent(new Event('event', { bubbles: true }))
    }
    dispatch()
    expect(direct).toHaveBeenCalledOnce()
    expect(delegated).toHaveBeenCalledOnce()
    group.stop()
    dispatch()
    expect(direct).toHaveBeenCalledOnce()
    expect(delegated).toHaveBeenCalledOnce()
  })

  it('keeps direct batch entries direct while preserving capture and passive modifiers', () => {
    const group = On.group()
    const fn = vi.fn((event) => event.preventDefault())
    group.delegate.capture.passive.batch(root, { scroll: fn })
    const event = new Event('scroll', { cancelable: true })
    button.dispatchEvent(event)
    expect(fn).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(false)
    group.stop()
    button.dispatchEvent(new Event('scroll'))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('rolls back earlier batch listeners when a later registration fails', () => {
    const existing = vi.fn()
    const first = vi.fn()
    const second = vi.fn()
    On.click(button, existing)
    const reason = new Error('batch registration failed')
    const nativeAdd = button.addEventListener.bind(button)
    vi.spyOn(button, 'addEventListener').mockImplementation((type, ...args) => {
      if (type === 'mouseover') throw reason
      return nativeAdd(type, ...args)
    })

    expect(() => On.batch(button, { click: first, mouseover: second })).toThrow(reason)
    button.dispatchEvent(new Event('click'))
    button.dispatchEvent(new Event('mouseover'))
    expect(existing).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()
  })

  it('rolls back grouped hover listeners when the second registration fails', () => {
    const existing = vi.fn()
    const enter = vi.fn()
    const leave = vi.fn()
    On.mouseenter(button, existing)
    const reason = new Error('hover registration failed')
    const nativeAdd = button.addEventListener.bind(button)
    vi.spyOn(button, 'addEventListener').mockImplementation((type, ...args) => {
      if (type === 'mouseleave') throw reason
      return nativeAdd(type, ...args)
    })
    const group = On.group()

    expect(() => group.hover(button, enter, leave)).toThrow(reason)
    button.dispatchEvent(new MouseEvent('mouseenter'))
    button.dispatchEvent(new MouseEvent('mouseleave'))
    expect(existing).toHaveBeenCalledOnce()
    expect(enter).not.toHaveBeenCalled()
    expect(leave).not.toHaveBeenCalled()
    expect(() => group.stop()).not.toThrow()
  })

  it('keeps the registration error first when batch rollback also fails', () => {
    const registration = new Error('batch registration failed')
    const cleanup = new Error('batch rollback failed')
    const first = vi.fn()
    const second = vi.fn()
    const nativeAdd = button.addEventListener.bind(button)
    vi.spyOn(button, 'addEventListener').mockImplementation((type, ...args) => {
      if (type === 'mouseover') throw registration
      return nativeAdd(type, ...args)
    })
    vi.spyOn(button, 'removeEventListener').mockImplementation(function (type, ...args) {
      if (type === 'click') throw cleanup
      return EventTarget.prototype.removeEventListener.call(this, type, ...args)
    })

    try {
      On.batch(button, { click: first, keydown: second, mouseover: vi.fn() })
      expect.unreachable('batch setup must report registration failure')
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError)
      expect(error.errors).toHaveLength(2)
      expect(error.errors[0]).toBe(registration)
      expect(error.errors[1]).toBe(cleanup)
    }

    button.dispatchEvent(new Event('click'))
    button.dispatchEvent(new Event('keydown'))
    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  it('mixes passive fluent observers with an explicitly non-passive captured click', () => {
    const group = On.group()
    const observe = vi.fn((event) => event.preventDefault())
    const tap = vi.fn((event) => event.preventDefault())
    group.capture.passive.pointerover(root, observe)
    group.add(on(root, 'click', tap, { capture: true, passive: false }))

    const over = new Event('pointerover', { bubbles: true, cancelable: true })
    button.dispatchEvent(over)
    expect(observe).toHaveBeenCalledOnce()
    expect(over.defaultPrevented).toBe(false)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(button.dispatchEvent(click)).toBe(false)
    expect(click.defaultPrevented).toBe(true)
    expect(tap).toHaveBeenCalledOnce()

    group.stop()
    const afterStop = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(button.dispatchEvent(afterStop)).toBe(true)
    expect(afterStop.defaultPrevented).toBe(false)
    button.dispatchEvent(new Event('pointerover', { bubbles: true }))
    expect(observe).toHaveBeenCalledOnce()
    expect(tap).toHaveBeenCalledOnce()
  })

  it.each(['pointerdown', 'keydown', 'wheel', 'dragenter', 'mouseenter'])('retires a shared takeover scope on %s while preserving visitor delivery', (type) => {
    const group = On.group()
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const removeButton = vi.spyOn(button, 'removeEventListener')
    const stopDemo = vi.fn(() => group.stop())
    for (const event of ['pointerdown', 'keydown', 'wheel', 'dragenter']) {
      group.add(on(document, event, stopDemo, { capture: true, passive: true }))
    }
    group.add(on(button, 'mouseenter', stopDemo))

    const visitor = vi.fn((event) => {
      expect(stopDemo).toHaveBeenCalledOnce()
      expect(event.defaultPrevented).toBe(false)
    })
    const bubbled = vi.fn()
    button.addEventListener(type, visitor, { once: true })
    root.addEventListener(type, bubbled, { once: true })
    const event = new Event(type, { bubbles: type !== 'mouseenter', cancelable: true })
    try {
      expect(button.dispatchEvent(event)).toBe(true)
      expect(event.defaultPrevented).toBe(false)
      expect(visitor).toHaveBeenCalledOnce()
      expect(bubbled).toHaveBeenCalledTimes(type === 'mouseenter' ? 0 : 1)
      expect(removeDocument.mock.calls.map(([event, , options]) => [event, options.capture])).toEqual([
        ['pointerdown', true], ['keydown', true], ['wheel', true], ['dragenter', true],
      ])
      expect(removeButton).toHaveBeenCalledWith('mouseenter', expect.any(Function), { capture: false })

      for (const event of ['pointerdown', 'keydown', 'wheel', 'dragenter', 'mouseenter']) {
        button.dispatchEvent(new Event(event, { bubbles: event !== 'mouseenter' }))
      }
      expect(stopDemo).toHaveBeenCalledOnce()
      group.stop()
      expect(removeDocument).toHaveBeenCalledTimes(4)
      expect(removeButton).toHaveBeenCalledTimes(1)

      const fresh = On.group()
      const next = vi.fn(() => fresh.stop())
      fresh.add(on(document, 'pointerdown', next, { capture: true, passive: true }))
      try {
        group.stop()
        button.dispatchEvent(new Event('pointerdown', { bubbles: true }))
        expect(next).toHaveBeenCalledOnce()
        expect(stopDemo).toHaveBeenCalledOnce()
      } finally {
        fresh.stop()
      }
    } finally {
      group.stop()
      button.removeEventListener(type, visitor)
      root.removeEventListener(type, bubbled)
    }
  })

  it('waits for a matching delegated event before consuming once', () => {
    const other = document.createElement('span')
    root.append(other)
    const fn = vi.fn(function () { expect(this).toBe(button) })
    const stop = On.first.delegate.click(root, 'button', fn)
    other.click()
    button.firstChild.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    button.click()
    stop()
    expect(fn).toHaveBeenCalledOnce()
  })

  it.each([false, true])('removes once before a reentrant callback (delegated=%s)', (delegated) => {
    const fn = vi.fn(() => button.dispatchEvent(new Event('click', { bubbles: true })))
    const stop = delegated
      ? On.first.delegate.click(root, 'button', fn)
      : On.first.click(button, fn)
    button.click()
    stop()
    expect(fn).toHaveBeenCalledOnce()
  })

  it.each(['once', 'abort', 'already aborted'])('releases records after %s', (expiry) => {
    const fn = vi.fn()
    const controller = new AbortController()
    if (expiry === 'already aborted') controller.abort()
    const remove = vi.spyOn(button, 'removeEventListener')
    const stop = on(button, 'click', fn, expiry === 'once' ? { once: true } : { signal: controller.signal })
    if (expiry === 'once') button.click()
    else controller.abort()
    remove.mockClear()

    // Stale records would cause off() to attempt removal again.
    off(button, 'click', fn)
    stop()
    expect(remove).not.toHaveBeenCalled()
    button.click()
    expect(fn).toHaveBeenCalledTimes(expiry === 'once' ? 1 : 0)
  })

  it.each(['stop', 'once', 'abort'])('detaches its abort hook after %s', (expiry) => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const stop = on(button, 'click', vi.fn(), { signal: controller.signal, once: expiry === 'once' })
    if (expiry === 'stop') stop()
    if (expiry === 'once') button.click()
    if (expiry === 'abort') controller.abort()
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('cancels grouped ready callbacks before DOMContentLoaded', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    const fn = vi.fn()
    const group = On.group()
    group.capture.passive.ready(fn)
    group.stop()
    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(fn).not.toHaveBeenCalled()
  })

  it('returns a stop handle for a pending ready callback', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    const fn = vi.fn()
    const stop = On.ready(fn)
    expect(stop).toBeTypeOf('function')
    stop()
    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(fn).not.toHaveBeenCalled()
  })

  it('runs pending ready callbacks only once', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    const fn = vi.fn()
    const stop = On.ready(fn)
    document.dispatchEvent(new Event('DOMContentLoaded'))
    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(fn).toHaveBeenCalledOnce()
    expect(stop).toBeTypeOf('function')
  })

  it('returns a harmless stop handle when already ready or outside the DOM', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    const fn = vi.fn()
    expect(On.ready(fn)).toBeTypeOf('function')
    expect(fn).toHaveBeenCalledOnce()
    vi.stubGlobal('document', undefined)
    const stop = On.ready(fn)
    expect(stop).toBeTypeOf('function')
    stop()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('attempts every cleanup and aggregates failures before allowing reuse', () => {
    const group = On.group()
    const a = new Error('a')
    const b = new Error('b')
    group.add(() => { throw a })
    group.add(() => { throw b })
    const fn = vi.fn()
    group.click(button, fn)
    try {
      group.stop()
      expect.unreachable('stop must report cleanup errors')
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError)
      expect(error.errors).toEqual([a, b])
    }
    button.click()
    expect(fn).not.toHaveBeenCalled()
    expect(() => group.stop()).not.toThrow()
    group.click(button, fn)
    button.click()
    group.stop()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('handles a reentrant group stop without repeating custom cleanups', () => {
    const group = On.group()
    const cleanup = vi.fn(() => group.stop())
    group.add(cleanup)
    group.click(button, vi.fn())
    group.stop()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('scopes hover listeners and keeps a manually stopped binding isolated', () => {
    const group = On.group()
    const enter = vi.fn()
    const leave = vi.fn()
    const stop = group.capture.passive.hover(button, enter, leave)
    button.dispatchEvent(new MouseEvent('mouseenter'))
    button.dispatchEvent(new MouseEvent('mouseleave'))
    expect(enter).toHaveBeenCalledOnce()
    expect(leave).toHaveBeenCalledOnce()
    stop()
    const replacement = On.hover(button, enter, leave)
    group.stop()
    button.dispatchEvent(new MouseEvent('mouseenter'))
    button.dispatchEvent(new MouseEvent('mouseleave'))
    expect(enter).toHaveBeenCalledTimes(2)
    expect(leave).toHaveBeenCalledTimes(2)
    replacement()
  })
})
