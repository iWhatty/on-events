# on-events

[![npm](https://img.shields.io/npm/v/on-events)](https://www.npmjs.com/package/on-events)
[![downloads](https://img.shields.io/npm/dm/on-events)](https://www.npmjs.com/package/on-events)
[![bundle size](https://img.shields.io/bundlephobia/minzip/on-events)](https://bundlephobia.com/package/on-events)
[![license](https://img.shields.io/npm/l/on-events)](https://github.com/iWhatty/on-events/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/iWhatty/on-events?style=social)](https://github.com/iWhatty/on-events)
[![types](https://img.shields.io/npm/types/on-events)](https://www.npmjs.com/package/on-events)

A tiny DOM event utility with composable sugar. Write clean event bindings using fluent chains like `On.click(...)`, `On.capture.passive.scroll(...)`, `On.first.delegate.click(...)`, or classic `on(el, 'click', fn)`.

## Features

- `on(el, 'click', fn)` for classic binding
- `On.click(el, fn)` for fluent sugar per event name
- `On.first.click(el, fn)` fires once then unbinds
- `On.capture.passive.scroll(el, fn)` for fully composable modifiers
- `On.delegate.click(el, selector, fn)` for delegated events
- `On.hover(el, enter, leave)` for mouseenter/leave pairs
- `On.batch(el, { click, ... })` binds multiple events at once
- `On.first.batch(...)` for one-time multi-bind
- `On.ready(fn)` runs when DOM is ready
- `On.group()` collects related listeners and tears them down together
- Better TS support for simple binds like `On.input(el, fn)` and `On.change(el, fn)`
- ESM, zero dependencies, tiny footprint

---

## Install

```sh
pnpm add on-events
```

As of 0.0.5 the default entry routes bundlers at ESM source so unused exports can be tree-shaken; pre-built minified bundle remains available via the `on-events/min` subpath for unbundled `<script type="module">` use.

---

## Quick start

Compose `once`, `capture`, `passive`, and delegation without repetitive option objects:

```js
import { On } from 'on-events'

function handleLinkClick(e) {
  e.preventDefault()
  console.log('First captured delegated click:', this.href)
}

On.first.delegate.capture.click(document, 'a.nav-link', handleLinkClick)
```

- Delegated
- Capture phase
- Fires once
- Clean `this` binding
- Returns `stop()` if you need manual control

---

## API

### `On.<event>(el, fn)`

Direct fluent binding per event name.

```js
import { On } from 'on-events'

On.click(button, function handleClick() {
  console.log('Clicked')
})
```

### Composable modifiers

Modifiers can be chained before the event name. Order-independent.

Available modifiers:

- `first` / `once` → `{ once: true }`
- `capture` → `{ capture: true }`
- `passive` → `{ passive: true }`
- `delegate` → enables delegated signature `(el, selector, handler)`

```js
On.first.click(el, fn)
On.capture.scroll(window, fn)
On.passive.wheel(el, fn)
On.delegate.click(root, 'a', fn)
On.first.capture.passive.touchstart(el, fn)
```

### `On.hover(el, enterFn, leaveFn)`

Convenience wrapper for `mouseenter` and `mouseleave`. Returns a single `stop()` function.

```js
const stopHover = On.hover(card, function enterCard() {
  card.classList.add('hover')
}, function leaveCard() {
  card.classList.remove('hover')
})
```

### `On.batch(el, map)`

Bind multiple events at once.

```js
const stop = On.batch(window, {
  click: function handleWindowClick() {
    console.log('Window clicked')
  },
  keydown: function handleKeydown(e) {
    console.log('Key:', e.key)
  }
})

// Unbind all
stop()
```

Delegated entries are supported by passing `[selector, handler]`:

```js
On.batch(document, {
  click: ['button.save', function handleSave() {
    console.log('Saved')
  }]
})
```

### `On.first.batch(el, map)`

One-time version of `batch()`.

```js
On.first.batch(document, {
  scroll: function handleFirstScroll() {
    console.log('First scroll')
  },
  keyup: function handleFirstKeyup() {
    console.log('First keyup')
  }
})
```

### `On.ready(fn)`

Runs `fn` once the DOM is fully loaded (`DOMContentLoaded` or already ready).

```js
On.ready(function handleReady() {
  console.log('DOM fully loaded')
})
```

### `On.group()`

Creates a scoped cleanup collector for related listeners. Useful when a page, modal, or UI module binds listeners across multiple elements and wants one teardown call.

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

### `On.event(type)`

For custom or non-standard event names:

```js
const stop = On.event('panel:open')(panel, (e) => {
  console.log('opened', e.type)
})

stop()
```

### Low-level `on` / `off`

If you prefer a minimal, explicit API without fluent modifiers, use the core helpers directly.

```js
import { on, off } from 'on-events'

function handleKeydown(e) {
  console.log('Pressed:', e.key)
}

const stop = on(window, 'keydown', handleKeydown)

stop() // unbinds
```

Signatures:

- `on(el, event, handler)`
- `on(el, event, handler, options)`
- `on(el, event, selector, handler)` for delegated events
- `on(el, event, selector, handler, options)`
- `off(el, event, handler, [selector])` removes a previously added listener

Adds a standard or delegated event listener. Returns a `stop()` function that removes the listener.

---

## Notes

### Why not `addEventListener` directly?

`addEventListener` is great, this library just removes the repetitive parts when you bind lots of UI events.

- One-liners for common patterns (`once`, `capture`, `passive`, `delegate`)
- Every bind returns a `stop()` cleanup function
- Delegation helper that sets `this` to the matched element
- Batch binding to keep setup code tidy
- Grouped cleanup for lifecycle-based teardown
- Composable modifiers instead of option object juggling
- Zero deps and tiny footprint

### Performance note

This library is a thin wrapper around native `addEventListener`.

- **Direct binding** (`On.click(el, fn)` / `on(el, 'click', fn)`): essentially zero runtime overhead beyond one extra function call during setup.
- **`first` / `capture` / `passive`**: uses native listener options.
- **Delegation** (`On.delegate.*`): performs a `closest(selector)` lookup per event. Ideal for reducing listener count, but direct binding is better for extremely hot events like `mousemove`.

Rule of thumb: delegate `click`, `input`, and `submit`; bind directly for high-frequency events.

### Misc

- Delegation uses `Element.closest()` internally.
- In delegated handlers, `this` refers to the matched element.
- Modern browsers only (uses `Proxy`, `WeakMap`, and modern DOM APIs).
- All binding methods return a `stop()` function for explicit cleanup.

### Legacy alias

`On.once.*` is available as a backward-compatible alias for `On.first.*`.

---

## License

Licensed under AGPL-3.0 with WATT3D Additional Terms. See [LICENSE](./LICENSE) and [ADDITIONAL_TERMS.md](./ADDITIONAL_TERMS.md). Commercial AI/model-training use requires compliance with those terms or a separate WATT3D license. © WATT3D.
