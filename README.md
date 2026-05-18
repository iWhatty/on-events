
# on-events

[![npm](https://img.shields.io/npm/v/on-events)](https://www.npmjs.com/package/on-events)
[![downloads](https://img.shields.io/npm/dm/on-events)](https://www.npmjs.com/package/on-events)
[![bundle size](https://img.shields.io/bundlephobia/minzip/on-events)](https://bundlephobia.com/package/on-events)
[![license](https://img.shields.io/npm/l/on-events)](https://github.com/iWhatty/on-event-js/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/iWhatty/on-event-js?style=social)](https://github.com/iWhatty/on-event-js)

**A tiny DOM event utility with composable sugar.**


# on-events

**A tiny DOM event utility with composable sugar.**
Write clean event bindings using fluent chains like `On.click(...)`, `On.capture.passive.scroll(...)`, `On.first.delegate.click(...)`, or classic `on(el, 'click', fn)`.

---

## ⚡ Example Usage

Compose `once`, `capture`, `passive`, and delegation without repetitive option objects.

```js
import { On } from 'on-events'

function handleLinkClick(e) {
  e.preventDefault()
  console.log('First captured delegated click:', this.href)
}

On.first.delegate.capture.click(document, 'a.nav-link', handleLinkClick)
```

* Delegated
* Capture phase
* Fires once
* Clean `this` binding
* Returns `stop()` if you need manual control

---

## Features

* `on(el, 'click', fn)` — classic binding
* `On.click(el, fn)` — fluent sugar per event name
* `On.first.click(el, fn)` — fires once then unbinds
* `On.capture.passive.scroll(el, fn)` — fully composable modifiers
* `On.delegate.click(el, selector, fn)` — delegated events
* `On.hover(el, enter, leave)` — mouseenter/leave pair
* `On.batch(el, { click, ... })` — bind multiple events at once
* `On.first.batch(...)` — one-time multi-bind
* `On.ready(fn)` — run when DOM is ready
* `On.group()` — collect related listeners and tear them down together
* Better TS support for simple binds like `On.input(el, fn)` and `On.change(el, fn)`
* ESM, zero dependencies, tiny footprint

---

## Install

```bash
npm install on-events
```

---

## Fluent & Composable Sugar

```js
import { On } from 'on-events'

function handleClick() {
  console.log('Clicked')
}

function handleSubmit() {
  console.log('Submitted once')
}

function handleScroll() {
  console.log('Optimized scroll listener')
}

function handleDelegatedClick(e) {
  console.log('Clicked', this.textContent)
}

function handleComposedClick() {
  console.log('First captured delegated click')
}

function enterCard() {
  card.classList.add('hover')
}

function leaveCard() {
  card.classList.remove('hover')
}

// Basic
On.click(button, handleClick)

// Fires once
On.first.submit(form, handleSubmit)

// Capture + Passive (composable)
On.capture.passive.scroll(window, handleScroll)

// Delegate
On.delegate.click(document, 'button.action', handleDelegatedClick)

// Fully composed modifiers
On.first.delegate.capture.click(document, 'a', handleComposedClick)

// Hover helper
const stopHover = On.hover(card, enterCard, leaveCard)
```

---

## Batch Binding

```js
function handleWindowClick() {
  console.log('Window clicked')
}

function handleKeydown(e) {
  console.log('Key:', e.key)
}

const stop = On.batch(window, {
  click: handleWindowClick,
  keydown: handleKeydown
})

// Unbind all
stop()
```

---

## One-Time Batch Binding

```js
function handleFirstScroll() {
  console.log('First scroll')
}

function handleFirstKeyup() {
  console.log('First keyup')
}

On.first.batch(document, {
  scroll: handleFirstScroll,
  keyup: handleFirstKeyup
})
```

---

## Delegate Batch

You may pass `[selector, handler]` for delegated batch entries:

```js
function handleSave() {
  console.log('Saved')
}

On.batch(document, {
  click: ['button.save', handleSave]
})
```

---

## DOM Ready

```js
function handleReady() {
  console.log('DOM fully loaded')
}

On.ready(handleReady)
```

---

## Grouped Cleanup

When a UI module binds listeners across multiple elements, `On.group()` lets you track them under one scoped teardown handle.

```js
import { On } from 'on-events'

const page = On.group()

page.click(settingsToggleBtn, () => {
  settingsSection.classList.toggle('collapsed')
})

page.input(searchInput, handleSearch)
page.delegate.click(document, 'button.save', handleSave)

// Later:
page.stop()
```

You can also manually add an existing cleanup function:

```js
const group = On.group()

group.add(On.click(button, handleClick))
group.add(null) // safely ignored

group.stop()
```

---

## Custom Events

For custom or non-standard event names, use `On.event(type)`:

```js
const stop = On.event('panel:open')(panel, (e) => {
  console.log('opened', e.type)
})

stop()
```

---

# API Reference

## Composable Modifiers

Modifiers can be chained before the event name.

### Available Modifiers

* `first` / `once` → `{ once: true }`
* `capture` → `{ capture: true }`
* `passive` → `{ passive: true }`
* `delegate` → enables delegated signature `(el, selector, handler)`

### Examples

```js
On.first.click(el, fn)
On.capture.scroll(window, fn)
On.passive.wheel(el, fn)
On.delegate.click(root, 'a', fn)
On.first.capture.passive.touchstart(el, fn)
```

Modifiers are fully composable and order-independent.

---

## `On.hover(el, enterFn, leaveFn)`

Convenience wrapper for `mouseenter` and `mouseleave`.
Returns a single `stop()` function.

---

## `On.batch(el, map)`

Bind multiple events at once:

```js
On.batch(el, {
  click: fn1,
  keydown: fn2
})
```

Returns a single `stop()` function that removes all listeners.

---

## `On.first.batch(el, map)`

One-time version of `batch()`.

---

## `On.ready(fn)`

Runs `fn` once the DOM is fully loaded (`DOMContentLoaded` or already ready).

---

## `On.group()`

Creates a scoped cleanup collector for related listeners.

```js
const group = On.group()

group.click(button, onClick)
group.input(input, onInput)

group.stop()
```

Useful when a page, modal, or UI module binds listeners across multiple elements and wants one teardown call.

---

## Why not `addEventListener` directly?

`addEventListener` is great — this library just removes the repetitive parts when you bind lots of UI events.

* One-liners for common patterns (`once`, `capture`, `passive`, `delegate`)
* Every bind returns a `stop()` cleanup function
* Delegation helper that sets `this` to the matched element
* Batch binding to keep setup code tidy
* Grouped cleanup for lifecycle-based teardown
* Composable modifiers instead of option object juggling
* Zero deps and tiny footprint

---

## Tiny performance note

This library is a thin wrapper around native `addEventListener`.

* **Direct binding (`On.click(el, fn)` / `on(el, 'click', fn)`)**: essentially zero runtime overhead beyond one extra function call during setup.
* **`first` / `capture` / `passive`**: uses native listener options.
* **Delegation (`On.delegate.*`)**: performs a `closest(selector)` lookup per event. Ideal for reducing listener count, but direct binding is better for extremely hot events like `mousemove`.

Rule of thumb: delegate `click`, `input`, and `submit`; bind directly for high-frequency events.

---

## Notes

* Delegation uses `Element.closest()` internally.
* In delegated handlers, `this` refers to the matched element.
* Modern browsers only (uses `Proxy`, `WeakMap`, and modern DOM APIs).
* All binding methods return a `stop()` function for explicit cleanup.

---

## Low-level API (`on` / `off`)

If you prefer a minimal, explicit API without fluent modifiers, you can use the core helpers directly.

### `on(el, event, handler)`

### `on(el, event, handler, options)`

### `on(el, event, selector, handler)`

### `on(el, event, selector, handler, options)`

Adds a standard or delegated event listener.
Returns a `stop()` function that removes the listener.

```js
import { on, off } from 'on-events'

function handleKeydown(e) {
  console.log('Pressed:', e.key)
}

const stop = on(window, 'keydown', handleKeydown)

stop() // unbinds
```

### `off(el, event, handler, [selector])`

Removes a previously added listener.

---

## Legacy Alias

* `On.once.*` is available as a backward-compatible alias for `On.first.*`

---

## License

--{DR.WATT v3.0}--
