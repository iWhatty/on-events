// on-events.js
// On-Events — tiny DOM event utility with composable sugar.

// --- internal base ---
const listeners = new WeakMap()

/**
 * baseOn(el, type, handler)
 * baseOn(el, type, selector, handler)
 * baseOn(el, type, handler, options)
 * baseOn(el, type, selector, handler, options)
 */
function baseOn(el, type, selector, cb, options) {
  // Normalize overloaded signatures so everything below can use one path.
  if (typeof selector === 'function') {
    options = cb
    cb = selector
    selector = null
  }

  const opts = options || undefined

  const wrapped = selector
    ? (e) => {
      // Delegation can receive a Text node as the event target.
      // Normalize that to an element before calling closest().
      const target = e.target instanceof Element ? e.target : e.target?.parentElement
      if (!target) return

      const match = target.closest(selector)
      if (!match) return

      // Guard delegated matching so odd targets like window do not explode.
      if (typeof el.contains === 'function' && el.contains(match)) {
        cb.call(match, e)
      }
    }
    : cb

  el.addEventListener(type, wrapped, opts)

  if (!listeners.has(el)) listeners.set(el, [])
  const group = listeners.get(el)

  group.push({
    type,
    cb,
    selector,
    wrapped,
    capture: opts === true || !!(opts && opts.capture), // capture must match during removal
  })

  return () => off(el, type, cb, selector)
}

function off(el, type, cb, selector = null) {
  const group = listeners.get(el)
  if (!group) return

  for (let i = group.length; i-- > 0;) {
    const h = group[i]
    const match =
      h.type === type &&
      h.cb === cb &&
      (selector ? h.selector === selector : !h.selector)

    if (match) {
      // removeEventListener only cares about capture on teardown.
      el.removeEventListener(type, h.wrapped, { capture: h.capture })
      group.splice(i, 1)
    }
  }

  if (!group.length) listeners.delete(el)
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

const makeOn = (flags = 0) =>
  new Proxy(Object.create(null), {
    get(target, prop) {
      // Respect concrete properties assigned directly onto the proxy target.
      // This is what makes late-added members like On.group work instead of
      // being mistaken for an event name.
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop)
      }

      const k = String(prop)

      // Modifier chaining accumulates flags and returns a fresh proxy.
      if (k === 'first' || k === 'once') return makeOn(flags | ONCE)
      if (k === 'capture') return makeOn(flags | CAPTURE)
      if (k === 'passive') return makeOn(flags | PASSIVE)
      if (k === 'delegate') return makeOn(flags | DELEGATE)

      // Custom event helper: On.event('panel:open')(el, fn)
      if (k === 'event') {
        return (type) => makeOn(flags)[type]
      }

      // Utilities live on the same fluent surface for ergonomics.
      if (k === 'hover') {
        return (el, enter, leave) => {
          const o = optsFor(flags)
          const offIn = baseOn(el, 'mouseenter', enter, o)
          const offOut = baseOn(el, 'mouseleave', leave, o)
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
              stops.push(makeOn(flags)[event](el, val))
              continue
            }

            // Delegated entry: { click: ['a', fn] }
            if (Array.isArray(val)) {
              const [selector, fn] = val
              stops.push(makeOn(flags | DELEGATE)[event](el, selector, fn))
            }
          }

          return () => {
            for (const stop of stops) stop()
          }
        }
      }

      if (k === 'ready') {
        return (fn) => {
          if (typeof document === 'undefined') return

          // Run immediately if the DOM is already ready.
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true })
          } else {
            fn()
          }
        }
      }

      // Default path: treat the property name as the event type.
      return (el, ...args) => {
        const o = optsFor(flags)

        if (flags & DELEGATE) {
          const [selector, handler] = args
          return baseOn(el, k, selector, handler, o)
        }

        const [handler] = args
        return baseOn(el, k, handler, o)
      }
    },
  })

const On = makeOn()

// Creates a scoped listener collector.
// Any stop() returned by On.* calls is tracked and can be removed together via group.stop().
On.group = function group() {
  const stops = new Set()

  const track = (stop) => {
    // Pass through nullish / false values so callers can safely write:
    // group.add(maybeElement ? On.click(...) : null)
    if (typeof stop === 'function') stops.add(stop)
    return stop
  }

  const stopAll = () => {
    const errors = []

    // Try every tracked cleanup so one bad stop() does not block the rest.
    for (const stop of stops) {
      try {
        stop()
      } catch (err) {
        errors.push(err)
      }
    }

    stops.clear()

    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) {
      throw new AggregateError(errors, 'On.group().stop() failed for one or more listeners')
    }
  }

  const collect = (source) => new Proxy(Object.create(null), {
    get(_target, prop) {
      // Hard override these names so they never fall through into event binding.
      if (source === On && prop === 'add') return track
      if (source === On && prop === 'stop') return stopAll

      const value = source[prop]
      if (value == null) return value

      // event(type) is a factory: it returns a binder, not a stop handle.
      // Wrap the binder so the eventual stop() is what gets tracked.
      if (prop === 'event') {
        return (type) => {
          const binder = value(type)
          return (...args) => track(binder(...args))
        }
      }

      // Top-level callables like group.click(...), group.batch(...), group.ready(...)
      // are wrapped so any returned stop() is automatically tracked.
      if (typeof value === 'function') {
        return (...args) => track(value(...args))
      }

      // Track callable leaves at every depth of a modifier chain.
      return collect(value)
    },
  })

  return collect(On)
}

// --- legacy alias for backward compatibility ---
On.once = On.first

// --- classic support ---
const on = (el, event, ...args) => baseOn(el, event, ...args)

export { on, On, off }
