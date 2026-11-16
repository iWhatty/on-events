import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { on, On } from '../src/on-events.js'

describe('delegated matched-element argument', () => {
  let root, button, nested, group

  beforeEach(() => {
    root = document.createElement('div')
    root.innerHTML = '<button><span>Click</span></button>'
    button = root.querySelector('button')
    nested = root.querySelector('span')
    document.body.append(root)
    group = On.group()
  })

  afterEach(() => {
    group.stop()
    root.remove()
  })

  it.each(['element', 'text'])('provides the nearest matching element for an %s target', (kind) => {
    const handler = vi.fn()
    group.delegate.click(root, 'button', handler)
    const target = kind === 'text' ? nested.firstChild : nested
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.contexts[0]).toBe(button)
    expect(handler.mock.calls[0][1]).toBe(button)
    expect(handler.mock.calls[0][0].target).toBe(target)
  })

  it('supports bound controller methods and arrow callbacks', () => {
    const controller = {
      matches: [],
      contexts: [],
      handle(event, matched) {
        this.contexts.push(this)
        this.matches.push(matched)
      },
    }
    const matches = []
    const arrow = vi.fn((event, matched) => matches.push(matched))
    group.capture.passive.delegate.click(root, 'button', controller.handle.bind(controller))
    group.delegate.click(root, 'button', arrow)
    nested.click()
    expect(controller.matches).toEqual([button])
    expect(controller.contexts).toEqual([controller])
    expect(arrow).toHaveBeenCalledOnce()
    expect(matches).toEqual([button])
  })

  it('supports delegated classic, batch, and custom-event binders', () => {
    const handler = vi.fn()
    group.add(on(root, 'click', 'button', handler))
    group.batch(root, { click: ['button', handler] })
    group.passive.capture.delegate.event('click')(root, 'button', handler)
    nested.click()
    expect(handler).toHaveBeenCalledTimes(3)
    for (const [event, matched] of handler.mock.calls) {
      expect(event).toBeInstanceOf(MouseEvent)
      expect(matched).toBe(button)
    }
  })

  it('keeps existing one-argument handlers valid', () => {
    const handler = vi.fn((event) => expect(event.target).toBe(nested))
    group.delegate.click(root, 'button', handler)
    nested.click()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('excludes matching ancestors outside the delegation root', () => {
    const handler = vi.fn()
    group.delegate.click(root, 'body', handler)
    nested.click()
    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps once pending on misses and removes it before a matching reentrant callback', () => {
    const handler = vi.fn(() => nested.click())
    group.first.capture.passive.delegate.click(root, 'button', handler)
    root.click()
    nested.click()
    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0][1]).toBe(button)
  })

  it('keeps direct callback arguments and native context unchanged', () => {
    const handler = vi.fn()
    group.click(button, handler)
    button.click()
    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.contexts[0]).toBe(button)
    expect(handler.mock.calls[0]).toHaveLength(1)
    expect(handler.mock.calls[0][0]).toBeInstanceOf(MouseEvent)
  })
})
