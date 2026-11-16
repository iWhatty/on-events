import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { On } from '../src/on-events.js'
import { startValidatedHandshake } from '../examples/validated-handshake.js'

describe('documented validated handshake', () => {
  let owner, options

  beforeEach(() => {
    vi.useFakeTimers()
    owner = On.group()
    options = {
      receiver: window,
      peer: window,
      origin: 'https://viewer.example',
      session: 'session-a',
      load: vi.fn().mockResolvedValue('loaded'),
      onReady: vi.fn(),
      onError: vi.fn(),
      timeoutMs: 100,
    }
  })

  afterEach(() => {
    owner.stop()
    vi.useRealTimers()
  })

  const send = (options, overrides = {}) => options.receiver.dispatchEvent(new MessageEvent('message', {
    source: options.peer,
    origin: options.origin,
    data: { type: 'viewer:ready', session: options.session },
    ...overrides,
  }))

  it('rejects unrelated messages before accepting a valid delivery once', async () => {
    const finish = startValidatedHandshake(owner, options)
    for (const invalid of [
      { source: null },
      { origin: 'https://other.example' },
      { data: null },
      { data: 'viewer:ready' },
      { data: { type: 'wrong', session: options.session } },
      { data: { type: 'viewer:ready', session: 'other-session' } },
    ]) send(options, invalid)
    expect(options.load).not.toHaveBeenCalled()
    send(options)
    send(options)
    await vi.advanceTimersByTimeAsync(0)
    expect(options.load).toHaveBeenCalledOnce()
    expect(options.onReady).toHaveBeenCalledExactlyOnceWith('loaded')
    expect(options.onError).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    finish()
    owner.stop()
    expect(options.onReady).toHaveBeenCalledOnce()
  })

  it('allows two independent sessions to finish in reverse order', async () => {
    const second = { ...options, session: 'session-b', load: vi.fn().mockResolvedValue('second'), onReady: vi.fn() }
    startValidatedHandshake(owner, options)
    startValidatedHandshake(owner, second)
    send(second)
    await vi.advanceTimersByTimeAsync(0)
    expect(second.onReady).toHaveBeenCalledExactlyOnceWith('second')
    expect(options.onReady).not.toHaveBeenCalled()
    send(options)
    await vi.advanceTimersByTimeAsync(0)
    expect(options.onReady).toHaveBeenCalledExactlyOnceWith('loaded')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('expires pending listeners and timers on timeout', async () => {
    startValidatedHandshake(owner, options)
    await vi.advanceTimersByTimeAsync(100)
    expect(options.onError).toHaveBeenCalledOnce()
    expect(options.onError.mock.calls[0][0].message).toBe('Handshake timed out')
    send(options)
    expect(options.load).not.toHaveBeenCalled()
    expect(options.onReady).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['manual cancellation', 'owner stop'])('cancels pending handshakes through %s', async (mode) => {
    const finish = startValidatedHandshake(owner, options)
    if (mode === 'owner stop') owner.stop()
    else finish()
    send(options)
    await vi.advanceTimersByTimeAsync(100)
    expect(options.load).not.toHaveBeenCalled()
    expect(options.onReady).not.toHaveBeenCalled()
    expect(options.onError).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['resolve', 'reject'])('suppresses a late %s after owner destruction, even if load ignores abort', async (mode) => {
    let resolve, reject
    options.load.mockImplementation(() => new Promise((yes, no) => { resolve = yes; reject = no }))
    startValidatedHandshake(owner, options)
    send(options)
    const signal = options.load.mock.calls[0][0]
    expect(signal.aborted).toBe(false)
    owner.stop()
    expect(signal.aborted).toBe(true)
    if (mode === 'resolve') resolve('late result')
    else reject(new Error('late failure'))
    await vi.advanceTimersByTimeAsync(0)
    expect(options.onReady).not.toHaveBeenCalled()
    expect(options.onError).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports load failures once and removes all pending cleanup', async () => {
    const failure = new Error('load failed')
    options.load.mockRejectedValue(failure)
    startValidatedHandshake(owner, options)
    send(options)
    await vi.advanceTimersByTimeAsync(0)
    send(options)
    expect(options.onError).toHaveBeenCalledExactlyOnceWith(failure)
    expect(options.onReady).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
