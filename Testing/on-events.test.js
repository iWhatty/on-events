// ./Testing/on-events.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { on, off, On } from '../src/on-events.js'

describe('on-events', () => {
  let el, child

  beforeEach(() => {
    el = document.createElement('div')
    child = document.createElement('button')
    child.textContent = 'Click Me'
    el.appendChild(child)
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.removeChild(el)
  })

  it('binds a direct event', () => {
    const fn = vi.fn()
    const stop = on(child, 'click', fn)
    child.click()
    expect(fn).toHaveBeenCalledOnce()
    stop()
  })

  it('unbinds correctly', () => {
    const fn = vi.fn()
    on(child, 'click', fn)
    off(child, 'click', fn)
    child.click()
    expect(fn).not.toHaveBeenCalled()
  })

  it('supports delegation', () => {
    const fn = vi.fn()
    const stop = on(el, 'click', 'button', fn)
    child.click()
    expect(fn).toHaveBeenCalledOnce()
    stop()
  })

  it('unbinding works for delegated handler', () => {
    const fn = vi.fn()
    on(el, 'click', 'button', fn)
    off(el, 'click', fn, 'button')
    child.click()
    expect(fn).not.toHaveBeenCalled()
  })

  it('supports once option', () => {
    const fn = vi.fn()
    on(child, 'click', fn, { once: true })
    child.click()
    child.click()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('supports On.batch and cleanup', () => {
    const click = vi.fn()
    const over = vi.fn()
    const stop = On.batch(child, { click, mouseover: over })

    child.dispatchEvent(new Event('click'))
    child.dispatchEvent(new Event('mouseover'))

    expect(click).toHaveBeenCalledOnce()
    expect(over).toHaveBeenCalledOnce()

    stop()

    child.dispatchEvent(new Event('click'))
    child.dispatchEvent(new Event('mouseover'))

    expect(click).toHaveBeenCalledOnce()
    expect(over).toHaveBeenCalledOnce()
  })

  it('removes capture listeners correctly', () => {
    const fn = vi.fn()
    const stop = On.capture.click(child, fn)
    stop()
    child.click()
    expect(fn).not.toHaveBeenCalled()
  })

  it('delegation does not throw when event target is a Text node', () => {
    const fn = vi.fn()
    const stop = On.delegate.click(el, 'button', fn)

    const text = child.firstChild
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(fn).toHaveBeenCalledOnce()
    stop()
  })



  it('supports grouped cleanup', () => {
    const click = vi.fn()
    const over = vi.fn()

    const group = On.group()
    group.click(child, click)
    group.mouseover(child, over)

    child.click()
    child.dispatchEvent(new Event('mouseover'))

    expect(click).toHaveBeenCalledOnce()
    expect(over).toHaveBeenCalledOnce()

    group.stop()

    child.click()
    child.dispatchEvent(new Event('mouseover'))

    expect(click).toHaveBeenCalledOnce()
    expect(over).toHaveBeenCalledOnce()
  })

  it('group.add ignores nullish values safely', () => {
    const group = On.group()

    expect(group.add(null)).toBeNull()
    expect(group.add(undefined)).toBeUndefined()
    expect(group.add(false)).toBe(false)
  })

  it('supports custom event helper', () => {
    const fn = vi.fn()
    const stop = On.event('watt-test')(child, fn)

    child.dispatchEvent(new Event('watt-test'))

    expect(fn).toHaveBeenCalledOnce()
    stop()
  })



  it('supports grouped cleanup with composed modifiers', () => {
    const fn = vi.fn()
    const group = On.group()

    group.first.click(child, fn)

    child.click()
    child.click()

    expect(fn).toHaveBeenCalledOnce()

    group.stop()

    child.click()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('supports grouped delegated cleanup with composed modifiers', () => {
    const fn = vi.fn()
    const group = On.group()

    group.first.delegate.click(el, 'button', fn)

    child.click()
    child.click()

    expect(fn).toHaveBeenCalledOnce()

    group.stop()

    child.click()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('supports grouped custom event cleanup', () => {
    const fn = vi.fn()
    const group = On.group()

    group.event('watt-grouped')(child, fn)

    child.dispatchEvent(new Event('watt-grouped'))
    expect(fn).toHaveBeenCalledOnce()

    group.stop()

    child.dispatchEvent(new Event('watt-grouped'))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('supports grouped capture chain cleanup', () => {
    const fn = vi.fn()
    const group = On.group()

    group.capture.click(child, fn)

    child.click()
    expect(fn).toHaveBeenCalledOnce()

    group.stop()

    child.click()
    expect(fn).toHaveBeenCalledOnce()
  })



  it.each([false, true])('removes listeners with boolean capture %s', (capture) => {
    const fn = vi.fn()
    const stop = on(el, 'click', fn, capture)
    child.click()
    expect(fn).toHaveBeenCalledOnce()
    stop()
    stop()
    child.click()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('off removes delegated listeners with boolean capture', () => {
    const fn = vi.fn()
    on(el, 'click', 'button', fn, true)
    off(el, 'click', fn, 'button')
    child.click()
    expect(fn).not.toHaveBeenCalled()
  })

  it.each(['capture.passive', 'passive.capture.delegate'])('tracks grouped %s cleanup', (chain) => {
    const group = On.group()
    const fn = vi.fn()
    const binder = chain.split('.').reduce((value, key) => value[key], group)
    if (chain.includes('delegate')) binder.click(el, 'button', fn)
    else binder.click(el, fn)
    child.click()
    expect(fn).toHaveBeenCalledOnce()
    group.stop()
    child.click()
    expect(fn).toHaveBeenCalledOnce()
  })

  it.each(['capture', 'capture.passive'])('tracks grouped %s custom events', (chain) => {
    const group = On.group()
    const fn = vi.fn()
    const binder = chain.split('.').reduce((value, key) => value[key], group).event('panel:open')
    const stop = binder(child, fn)
    expect(stop).toBeTypeOf('function')
    child.dispatchEvent(new Event('panel:open'))
    expect(fn).toHaveBeenCalledOnce()
    group.stop()
    child.dispatchEvent(new Event('panel:open'))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('binds and cleans up both hover handlers', () => {
    const enter = vi.fn()
    const leave = vi.fn()
    const stop = On.hover(child, enter, leave)
    child.dispatchEvent(new MouseEvent('mouseenter'))
    child.dispatchEvent(new MouseEvent('mouseleave'))
    stop()
    child.dispatchEvent(new MouseEvent('mouseenter'))
    child.dispatchEvent(new MouseEvent('mouseleave'))
    expect(enter).toHaveBeenCalledOnce()
    expect(leave).toHaveBeenCalledOnce()
  })

  it('supports delegated batch entries and once aliases', () => {
    const click = vi.fn()
    const over = vi.fn()
    const stop = On.once.batch(el, { click: ['button', click], mouseover: over })
    child.click()
    child.click()
    child.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    child.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(click).toHaveBeenCalledOnce()
    expect(over).toHaveBeenCalledOnce()
    stop()
  })

  it('matches the nearest delegated element and excludes ancestors outside the root', () => {
    const inner = document.createElement('span')
    child.appendChild(inner)
    const fn = vi.fn()
    const outside = vi.fn()
    const stop = On.delegate.click(el, 'button', fn)
    const stopOutside = On.delegate.click(el, 'body', outside)
    inner.click()
    expect(fn).toHaveBeenCalledOnce()
    expect(fn.mock.contexts[0]).toBe(child)
    expect(outside).not.toHaveBeenCalled()
    stop()
    stopOutside()
  })

  it('consumes delegated once listeners on the first event, even without a match', () => {
    const fn = vi.fn()
    const stop = On.first.delegate.click(el, 'button', fn)
    el.click()
    child.click()
    expect(fn).not.toHaveBeenCalled()
    stop()
  })

  it.each(['loading', 'interactive', 'complete'])('runs ready callbacks when %s', (state) => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue(state)
    const fn = vi.fn()
    try {
      expect(On.ready(fn)).toBeUndefined()
      if (state === 'loading') expect(fn).not.toHaveBeenCalled()
      else expect(fn).toHaveBeenCalledOnce()
      document.dispatchEvent(new Event('DOMContentLoaded'))
      document.dispatchEvent(new Event('DOMContentLoaded'))
      expect(fn).toHaveBeenCalledOnce()
    } finally {
      readyState.mockRestore()
    }
  })

  it('ready is a no-op without a document', () => {
    const fn = vi.fn()
    vi.stubGlobal('document', undefined)
    try {
      expect(On.ready(fn)).toBeUndefined()
      expect(fn).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each([1, 2])('finishes grouped cleanup before reporting %s errors', (count) => {
    const group = On.group()
    const errors = Array.from({ length: count }, (_, i) => new Error('stop ' + i))
    for (const error of errors) group.add(() => { throw error })
    const cleanup = vi.fn()
    expect(group.add(cleanup)).toBe(cleanup)
    group.add(cleanup)
    let thrown
    try {
      group.stop()
    } catch (error) {
      thrown = error
    }
    if (count === 1) expect(thrown).toBe(errors[0])
    else {
      expect(thrown).toBeInstanceOf(AggregateError)
      expect(thrown.errors).toEqual(errors)
    }
    expect(cleanup).toHaveBeenCalledOnce()
    expect(() => group.stop()).not.toThrow()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('supports abort signals and explicit cleanup after abort', () => {
    const controller = new AbortController()
    const fn = vi.fn()
    const stop = on(child, 'click', fn, { signal: controller.signal })
    child.click()
    controller.abort()
    child.click()
    expect(fn).toHaveBeenCalledOnce()
    expect(() => stop()).not.toThrow()
  })

  it('stop removes both capture phases for the same handler', () => {
    const fn = vi.fn()
    const stop = on(el, 'click', fn)
    on(el, 'click', fn, { capture: true })
    child.click()
    expect(fn).toHaveBeenCalledTimes(2)
    stop()
    child.click()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})