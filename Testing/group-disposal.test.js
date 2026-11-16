import { afterEach, describe, expect, it, vi } from 'vitest'
import { On } from '../src/on-events.js'

afterEach(() => vi.restoreAllMocks())

describe('group cleanup ownership', () => {
  it('preserves add identity, deduplication, and repeat invocation after manual cleanup', () => {
    const group = On.group()
    const cleanup = vi.fn()
    expect(group.add(cleanup)).toBe(cleanup)
    expect(group.add(cleanup)).toBe(cleanup)
    cleanup()
    group.stop()
    group.stop()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('runs a deferred cleanup once across manual completion and parent teardown', () => {
    const group = On.group()
    const cleanup = vi.fn()
    const finish = group.defer(cleanup)
    expect(finish).not.toBe(cleanup)
    finish()
    finish()
    group.stop()
    finish()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('removes a completed entry before invoking a throwing cleanup', () => {
    const group = On.group()
    const failure = new Error('cleanup failed')
    let pending
    const cleanup = vi.fn(() => {
      expect(pending.has(finish)).toBe(false)
      throw failure
    })
    // Capture the owning collection to verify release, not just repeat-call suppression.
    const add = vi.spyOn(Set.prototype, 'add')
    let finish
    try {
      finish = group.defer(cleanup)
      const index = add.mock.calls.findIndex(([value]) => value === finish)
      pending = add.mock.contexts[index]
    } finally {
      add.mockRestore()
    }
    expect(pending.has(finish)).toBe(true)
    expect(() => finish()).toThrow(failure)
    expect(() => finish()).not.toThrow()
    expect(() => group.stop()).not.toThrow()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('keeps separate defer calls independent even with the same callback', () => {
    const group = On.group()
    const cleanup = vi.fn()
    const a = group.defer(cleanup)
    const b = group.defer(cleanup)
    expect(a).not.toBe(b)
    a()
    group.stop()
    b()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('supports reentrant completion and group teardown', () => {
    const group = On.group()
    const cleanup = vi.fn(() => {
      finish()
      group.stop()
    })
    const finish = group.defer(cleanup)
    const other = vi.fn()
    group.defer(other)
    finish()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(other).toHaveBeenCalledOnce()
  })

  it('runs remaining manual and DOM cleanups before reporting failures', () => {
    const group = On.group()
    const failures = [new Error('defer'), new Error('add')]
    const finish = group.defer(() => { throw failures[0] })
    group.add(() => { throw failures[1] })
    const cleanup = vi.fn()
    group.defer(cleanup)
    const target = new EventTarget()
    const handler = vi.fn()
    group.event('ping')(target, handler)
    try {
      group.stop()
      expect.unreachable('cleanup failures must be reported')
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError)
      expect(error.errors).toEqual(failures)
    }
    target.dispatchEvent(new Event('ping'))
    expect(handler).not.toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(() => finish()).not.toThrow()
    expect(() => group.stop()).not.toThrow()
  })

  it('preserves the original error when only one deferred cleanup fails', () => {
    const group = On.group()
    const failure = new Error('cleanup')
    group.defer(() => { throw failure })
    expect(() => group.stop()).toThrow(failure)
    expect(() => group.stop()).not.toThrow()
  })

  it('allows reuse and leaves new work added during teardown for the next stop', () => {
    const group = On.group()
    const next = vi.fn()
    group.defer(() => group.defer(next))
    group.stop()
    expect(next).not.toHaveBeenCalled()
    group.stop()
    expect(next).toHaveBeenCalledOnce()
  })

  it.each([null, undefined, false, 42])('rejects non-function defer input %s', (value) => {
    const group = On.group()
    expect(() => group.defer(value)).toThrow(TypeError)
    expect(() => group.stop()).not.toThrow()
  })
})
