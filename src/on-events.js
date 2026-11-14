// on-events.js
// On-Events — tiny DOM event utility with composable sugar.

// --- internal base ---
const listeners = new WeakMap()

const noop = () => {}

// Every API path ends here. Each registration owns its listener and cleanup.
function bind(el, type, selector, cb, options, scope) {
  if (typeof cb !== 'function') throw new TypeError('Expected an event handler function')

  const opts = typeof options === 'boolean' ? { capture: options } : options || {}
  const capture = !!opts.capture
  const once = !!opts.once
  const passive = opts.passive
  const signal = opts.signal
  if (signal?.aborted) return noop

  let active = true
  const record = { type, cb, selector, stop }

  function stop() {
    if (!active) return
    active = false
    el.removeEventListener(type, wrapped, capture)
    signal?.removeEventListener('abort', stop)
    const records = listeners.get(el)
    records?.delete(record)
    if (records?.size === 0) listeners.delete(el)
    scope?.delete(stop)
  }

  function wrapped(event) {
    let context = this
    if (selector !== null) {
      // Text nodes and elements from other windows are valid delegated targets.
      const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement
      context = target?.closest(selector)
      if (!context || typeof el.contains !== 'function' || !el.contains(context)) return
    }

    // Remove before invoking user code, including reentrant dispatches.
    // Delegated once listeners expire only after a selector match.
    if (once) stop()
    cb.call(context, event)
  }

  // Preserve inherited option fields and the browser's default passive policy.
  const nativeOptions = { capture, signal, once: false }
  if (passive !== undefined) nativeOptions.passive = passive
  el.addEventListener(type, wrapped, nativeOptions)
  if (!listeners.has(el)) listeners.set(el, new Set())
  listeners.get(el).add(record)
  scope?.add(stop)
  signal?.addEventListener('abort', stop, { once: true })
  return stop
}

function off(el, type, cb, selector = null) {
  const records = listeners.get(el)
  if (!records) return
  // Explicit off() keeps its broad matching semantics; stop handles are exact.
  for (const record of records) {
    if (record.type === type && record.cb === cb && record.selector === selector) record.stop()
  }
}

// --- composable sugar: On.<mods>.<event>(...) ---
// Bitflags keep the proxy small and cheap.
const ONCE = 1
const CAPTURE = 2
const PASSIVE = 4
const DELEGATE = 8

const optsFor = (f) => {
  // Allocate listener options only when needed.
  // Capture is stored separately so removeEventListener can match it later.
  if (!(f & (ONCE | CAPTURE | PASSIVE))) return undefined

  const o = {}
  if (f & ONCE) o.once = true
  if (f & CAPTURE) o.capture = true
  if (f & PASSIVE) o.passive = true
  return o
}

// Explicit event names never pass through the fluent proxy's helper lookup.
const eventBinder = (type, flags, scope) => (el, ...args) => {
  const delegated = !!(flags & DELEGATE)
  return bind(el, type, delegated ? args[0] : null, args[delegated ? 1 : 0], optsFor(flags), scope)
}

const makeOn = (flags = 0, scope) =>
  new Proxy(Object.create(null), {
    get(target, prop) {
      // Respect concrete properties assigned directly onto the proxy target.
      // Root controls like group/add/stop do not propagate into modifier chains.
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop)
      }

      const k = String(prop)

      // Modifier chaining accumulates flags and returns a fresh proxy.
      if (k === 'first' || k === 'once') return makeOn(flags | ONCE, scope)
      if (k === 'capture') return makeOn(flags | CAPTURE, scope)
      if (k === 'passive') return makeOn(flags | PASSIVE, scope)
      if (k === 'delegate') return makeOn(flags | DELEGATE, scope)

      // Custom event helper: On.event('panel:open')(el, fn)
      if (k === 'event') {
        return (type) => eventBinder(type, flags, scope)
      }

      // Utilities live on the same fluent surface for ergonomics.
      if (k === 'hover') {
        return (el, enter, leave) => {
          const o = optsFor(flags)
          const offIn = bind(el, 'mouseenter', null, enter, o, scope)
          const offOut = bind(el, 'mouseleave', null, leave, o, scope)
          return () => {
            offIn()
            offOut()
          }
        }
      }

      if (k === 'batch') {
        return (el, map) => {
          const stops = []

          for (const [event, val] of Object.entries(map)) {
            // Direct entry: { click: fn }
            if (typeof val === 'function') {
              stops.push(eventBinder(event, flags & ~DELEGATE, scope)(el, val))
              continue
            }

            // Delegated entry: { click: ['a', fn] }
            if (Array.isArray(val)) {
              const [selector, fn] = val
              stops.push(eventBinder(event, flags | DELEGATE, scope)(el, selector, fn))
            }
          }

          return () => {
            for (const stop of stops) stop()
          }
        }
      }

      if (k === 'ready') {
        return (fn) => {
          if (typeof document === 'undefined') return noop

          // Run immediately if the DOM is already ready.
          if (document.readyState === 'loading') {
            return bind(document, 'DOMContentLoaded', null, fn, { once: true }, scope)
          }
          fn()
          return noop
        }
      }

      // Default path: treat the property name as the event type.
      return eventBinder(k, flags, scope)
    },
  })

const On = makeOn()

// Creates a scoped listener collector.
// Bindings created through this surface share one cleanup scope.
On.group = function group() {
  const stops = new Set()
  const scoped = makeOn(0, stops)
  let stopping = false

  scoped.add = (stop) => {
    // Pass through nullish / false values so callers can safely write:
    // group.add(maybeElement ? On.click(...) : null)
    if (typeof stop === 'function') stops.add(stop)
    return stop
  }

  scoped.stop = () => {
    if (stopping) return
    stopping = true
    const errors = []
    const pending = [...stops]
    stops.clear()

    // Try every tracked cleanup so one bad stop() does not block the rest.
    for (const stop of pending) {
      try {
        stop()
      } catch (err) {
        errors.push(err)
      }
    }

    stopping = false

    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) {
      throw new AggregateError(errors, 'On.group().stop() failed for one or more listeners')
    }
  }

  return scoped
}

// --- legacy alias for backward compatibility ---
On.once = On.first

// --- classic support ---
function on(el, type, selector, cb, options) {
  if (typeof selector === 'function') {
    return bind(el, type, null, selector, cb)
  }
  return bind(el, type, selector, cb, options)
}

export { on, On, off }
