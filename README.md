# on-events

[![npm](https://badgen.net/npm/v/on-events)](https://www.npmjs.com/package/on-events)
[![downloads](https://badgen.net/npm/dm/on-events)](https://www.npmjs.com/package/on-events)
[![license](https://badgen.net/static/license/AGPL-3.0%20%2B%20terms/blue)](https://github.com/iWhatty/on-events/blob/main/LICENSE)
[![stars](https://badgen.net/github/stars/iWhatty/on-events)](https://github.com/iWhatty/on-events)
[![types](https://badgen.net/npm/types/on-events)](https://www.npmjs.com/package/on-events)

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
- `group.defer(cleanup)` owns external cleanup with a self-removing, once-only handle
- Better TS support for simple binds like `On.input(el, fn)` and `On.change(el, fn)`
- ESM, zero dependencies, tiny footprint

---

## Install

```sh
pnpm add on-events
```

As of 0.0.5 the default entry routes bundlers at ESM source so unused exports can be tree-shaken; pre-built minified bundle remains available via the `on-events/min` subpath for unbundled `<script type="module">` use.

**Property-renaming compilers:** fluent event and modifier names must be preserved. Version `0.0.9` adds opt-in [compiler preservation files](./compiler/README.md). Use the [explicit `on()` + `group.add()` recipe](#property-renaming-compilers) when your complete build cannot preserve those names.

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

With delegation, `first` / `once` waits for the first event matching the selector. Unrelated events do not consume the listener.

```js
On.first.click(el, fn)
On.capture.scroll(window, fn)
On.passive.wheel(el, fn)
On.delegate.click(root, 'a', fn)
On.first.capture.passive.touchstart(el, fn)
```

### Delegated callback arguments (since 0.0.8)

Delegated handlers receive `(event, matchedElement)`. The second argument is the element that passed the selector and root-containment check, including when the original event target was a nested element or Text node. This applies to classic delegated `on()`, `On.delegate.*`, custom events, and delegated batch entries.

```js
panel.delegate.click(container, 'button.action', (event, matchedElement) => {
  matchedElement.classList.toggle('active')
})
```

Ordinary function callbacks still receive the matched element as `this`. Arrow callbacks and controller methods bound with `.bind(controller)` keep their normal JavaScript `this` and can use the second argument instead. Existing one-argument handlers continue to work. Direct handlers still receive only the event.

TypeScript infers the event type through modifiers and provides the match as `Element`; narrow that type when you need element-specific properties. The second argument was added in `0.0.8`; version `0.0.7` exposes delegated matches through `this` only.

Since `0.0.9`, fluent names and `On.event(type)` also infer standard document and window events such as `DOMContentLoaded`, `visibilitychange`, `message`, and `pagehide`.

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

Runs `fn` at `DOMContentLoaded` while the document is loading, or immediately if it is already interactive or complete. Returns a `stop()` handle that cancels a pending callback. If the DOM is already ready or `document` is unavailable, the returned handle is a no-op. Without `document`, the callback does not run.

```js
const stopReady = On.ready(function handleReady() {
  console.log('DOM fully loaded')
})
```

### `On.group()`

Creates a scoped cleanup collector for related listeners. Useful when a page, modal, or UI module binds listeners across multiple elements and wants one teardown call.

Modifier chains, custom events, batches, hover listeners, and pending ready callbacks all share the group's cleanup scope. A group can be reused after `stop()`.

`stop()` attempts every pending cleanup, reports a single failure directly or multiple failures as an `AggregateError`, and clears the current batch. Work registered by a cleanup remains pending for the next `stop()`. Cleanups run synchronously; the group does not await promises.

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

`add(fn)` returns the original function and registers the same function only once per pending batch. It passes through `null`, `undefined`, and `false`. Calling `fn()` manually does **not** remove that entry, so `group.stop()` can call it again. Arbitrary functions passed to `add()` must tolerate repeated calls. DOM stop handles returned by this library already tolerate repeated calls.

### Grouping explicit listener options

Combine fluent observers with classic `on()` when a listener needs an explicit option such as `passive: false`:

```js
import { On, on } from 'on-events'

const listeners = On.group()
const observe = listeners.capture.passive
observe.pointerover(document, handlePointerOver)
observe.blur(window, handleBlur)

listeners.add(on(document, 'click', handleTap, {
  capture: true,
  passive: false, // handleTap may call preventDefault()
}))

// Controller destruction removes both fluent and classic registrations:
listeners.stop()
```

Register this once per controller lifetime. It adds one bounded cleanup entry for the cancellable click listener, rather than an entry for each tap. The fluent `passive` modifier enables passive behavior; classic options are available when you need to explicitly disable it.

### First interaction across several bindings

To end a demo when any takeover event occurs, give those bindings one group and stop the group inside their shared callback. Per-binding `first` / `once` only removes the binding that fired; the other event types and targets would remain registered.

```js
import { on, On } from 'on-events'

const takeover = On.group()
let active = true
let frameTimer

function stopDemo() {
  if (!active) return
  active = false
  clearTimeout(frameTimer)
  takeover.stop()
}

for (const type of ['pointerdown', 'keydown', 'wheel', 'dragenter']) {
  takeover.add(on(document, type, stopDemo, { capture: true, passive: true }))
}
takeover.add(on(resultPane, 'mouseenter', stopDemo))

frameTimer = setTimeout(advanceDemo, 2600)
// Also call stopDemo() when the owning UI is destroyed.
```

The first interaction removes every takeover listener, including the one executing the callback. The callback does not call `preventDefault()` or stop propagation, so the same interaction can still reach the application's controls. Capture observes document events before target handlers; passive observers cannot cancel them. Plain pointer movement outside the result pane does not end this demo.

`advanceDemo` and `resultPane` belong to the application. If it schedules another frame, store the latest timer ID in `frameTimer`. State, timer cancellation, and presentation remain application responsibilities: `group.stop()` only runs registered cleanups. Create a fresh group and callback state for each demo lifetime. This recipe works with `0.0.7` and later and uses explicit event strings as described in the [compiler guidance](#property-renaming-compilers).

### `group.defer(cleanup)` (since 0.0.8)

Registers a cleanup function and returns a new, once-only disposer. Call the returned disposer to finish early, or let `group.stop()` invoke it. The disposer unregisters itself before cleanup runs and releases its cleanup and owner references when finished. Further calls do nothing, including after a cleanup throws. Each `defer()` call owns an independent entry, even when it receives the same callback.

Use the returned handle for manual completion; directly calling the original callback leaves the disposer pending. `defer()` accepts a function; use `add()` when you need its original-handle or nullish pass-through behavior.

```js
const panel = On.group()
let timer
const finish = panel.defer(() => clearTimeout(timer))

timer = setTimeout(() => {
  finish() // remove this completed timer's cleanup from the panel scope
  refreshStatus()
}, 1000)

// Closing the panel before the timer fires also cancels it:
panel.stop()
```

`defer()` is available from `0.0.8`. Version `0.0.7` uses the `add()` contract described above.

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
- `off(el, event, handler, [selector])` removes all matching registrations

Adds a standard or delegated event listener. Returns a `stop()` function that removes that registration.

Each binding call creates an independent registration, including calls that reuse the same handler. Its stop handle is idempotent and removes only that registration. Explicit `off()` removes all matching registrations for the target, event, handler, and selector, across capture modes.

The classic `on()` options accept a boolean capture flag or an `AddEventListenerOptions` object, including `signal` for cancellation with an `AbortController`.

---

## Notes

### Property-renaming compilers

The fluent API reads property names at runtime through a `Proxy`. A compiler that renames `listeners.capture.pointerdown(...)` can change the event name to a shortened property such as `'h'`, silently binding the wrong event. Modifier and helper names also need preservation. See [Closure Compiler's restrictions on property renaming](https://developers.google.com/closure/compiler/docs/limitations).

For builds that rename properties, use explicit event-name strings with classic `on()` and collect the returned stop handles with `group.add()`:

```js
import { on, On } from 'on-events'

const listeners = On.group()
listeners.add(on(document, 'pointerdown', handlePointerDown, { capture: true }))
listeners.add(on(document, 'pointerup', handlePointerUp))

// Controller destruction removes both registrations:
listeners.stop()
```

This keeps event names in strings and listener options in the native options object, while retaining grouped cleanup. The stop handles returned by `on()` are idempotent, so they are safe to pass to `group.add()`.

The explicit binding pattern was verified with the `0.0.8` source and consumer compiled together using Closure Compiler `20260422.0.0`, ADVANCED mode, and the BROWSER environment. Compatibility with arbitrary property-renaming configurations is not guaranteed; verify event names, options, callbacks, and cleanup in your final bundle. Preserve native option keys and any public properties crossing separately compiled boundaries.

Version `0.0.9` includes opt-in Closure externs and a generated property-name manifest, with a regression matrix for both package entries bundled with their consumers. See the [compiler guide](./compiler/README.md) for setup, application-defined events, and the tested scope. Version `0.0.8` does not include these preservation files.

Quoting fluent properties alone is not a reliable workaround: an earlier bundler stage can rewrite quoted access before property renaming runs. Importing `on-events/min` also does not protect its properties if a later compiler renames them. Preserve the protocol at every renaming stage; the package does not automatically configure your compiler.

### Scope ownership and short-lived nodes

Give each group the lifetime of the UI or task it owns. A stable panel can have separate scopes for always-present controls and enabled-only inspection. Stop the inspection scope on disable and the panel scope on destruction.

Binding every transient row or toast into a long-lived group retains each pending registration until its stop handle or group is stopped. Removing a node from the DOM does not complete its registration. Two useful patterns are:

- **Stable-container delegation:** bind once on the container and associate transient nodes with data in a `WeakMap`.
- **Child scopes:** give a row its own group and stop that group whenever the row is removed.

```js
const panel = On.group()
const toastData = new WeakMap()

// Set toastData.set(toastNode, item) when rendering a toast.
panel.delegate.click(toastContainer, '[data-toast]', (event, toast) => {
  const item = toastData.get(toast)
  if (item) showToastDetails(item)
})

// A row with its own listeners can instead have an explicitly owned child scope:
const row = On.group()
const releaseRow = panel.defer(row.stop)
row.click(closeButton, () => {
  releaseRow()
  rowElement.remove()
})
// Also call releaseRow() on any other row-removal path.
```

This recipe requires `0.0.8` or later for `defer()` and the matched-element argument. Groups own listeners and registered cleanups. Timers, observers, animation frames, console/network patches, and fetches need explicit application cleanup, such as `defer(() => observer.disconnect())` or `defer(() => controller.abort())`. Aborting work is cooperative; check ownership before applying a result that can arrive after teardown.

### Validated message handshakes

`On.first.message` expires on the first message event before callback-level validation. A handshake that must ignore unrelated traffic should use a regular scoped message listener and stop it after accepting the expected delivery.

The [tested application example](./examples/validated-handshake.js) validates the expected source window, exact origin, payload type, and session. Copy that helper into your application and pass it an owner group:

```js
import { startValidatedHandshake } from './validated-handshake.js'

const cancel = startValidatedHandshake(panel, {
  receiver: window,
  peer: viewerWindow,
  origin: 'https://viewer.example',
  session: sessionId,
  load: (signal) => fetch('/api/details', { signal }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }),
  onReady: renderDetails,
  onError: reportFailure,
  timeoutMs: 30_000,
})
```

The helper stops the listener and clears the timeout as soon as a valid message is accepted. Its disposer remains owned while loading, so owner destruction aborts the request and suppresses late results even if loading ignores cancellation. Manual cancellation, timeout, and load failure also release pending resources. Keep UI side effects in `onReady`; work inside `load` must follow the application's own authority and cancellation rules.

Share the session identifier through your application's protocol and send messages using the exact expected `targetOrigin`. Source, origin, and payload checks are application policy; a session correlates exchanges and does not authenticate individual scripts sharing a page. See the [postMessage security guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns).

The example requires `0.0.8` or later for `defer()`. With `0.0.7`, retain an explicit pending-resource collection for timer and task cleanup alongside the scoped message listener. The example's tests cover unrelated messages first, sessions finishing in reverse order, duplicate messages, timeout, owner destruction, and late success or failure. These are correctness checks; no speed or heap-size improvement is claimed.

### Asynchronous native EventTarget lifetimes

A resource's stop request is not always the end of its event lifetime. For `MediaRecorder`, the final `dataavailable` and `stop` events arrive asynchronously after `recorder.stop()`. Keep the listeners until successful finalization completes; on cancellation or failure, discard the recording and release ownership. See the [MediaStream Recording stop algorithm](https://www.w3.org/TR/mediastream-recording/#dom-mediarecorder-stop).

Copy the [tested recording example](./examples/async-native-recording.js) into your application. It uses the existing `on()` and `On.group()` APIs and does not add a package API:

```js
import { recordWithCleanup } from './async-native-recording.js'

const controller = new AbortController()
const stream = canvas.captureStream(30)
const clip = await recordWithCleanup({
  createRecorder: () => new MediaRecorder(stream, { mimeType }),
  signal: controller.signal,
  run: async (recorder, signal) => {
    for (const frame of frames) {
      signal.throwIfAborted()
      await renderFrame(frame, signal)
      signal.throwIfAborted()
      await waitForNextFrame(signal)
    }
  },
  release: () => {
    for (const track of stream.getTracks()) track.stop()
  },
})
// UI cancellation calls controller.abort(reason).
// The resolved clip includes the final chunks; its tracks are already stopped.
```

`canvas`, a supported `mimeType`, the frame sequence, rendering, and frame waits are application inputs. Each invocation creates one listener group for `dataavailable`, `error`, `stop`, and the optional abort signal. The helper owns startup and stop requests; `run` must not stop the recorder itself. Registration happens outside Promise executors so a setup exception immediately rolls back earlier bindings without starting the recorder or queued work.

The helper takes ownership of the synchronous `release()` callback when called: release still runs after pre-abort, construction failure, partial registration, cancellation, or listener-teardown failure. Every cleanup step is attempted. A lone failure is rethrown unchanged; multiple failures produce an `AggregateError` with the primary failure first and cleanup failures afterward. A group's own cleanup failures may be a nested `AggregateError`.

Work is raced against abort and recorder failure, with ownership checks before queued work and after waits. Removing listeners or rejecting that race does not terminate work already running. `run`, rendering, timers, and frame waits must cooperate with the signal and check it before late side effects. UI restoration, recording deadlines, codec support, and cancellation policy belong to the application.

The example requires the existing `0.0.9` APIs and is available in this repository; it is not part of the already-published `0.0.9` tarball. Its native Node tests exercise both source and minified entries with controllable asynchronous delivery and retained recorder/signal references. Those tests establish ownership and error handling, not real encoding, video fidelity, or cross-browser codec support.

### Why not `addEventListener` directly?

`addEventListener` is great, this library just removes the repetitive parts when you bind lots of UI events.

- One-liners for common patterns (`once`, `capture`, `passive`, `delegate`)
- Every bind returns a `stop()` cleanup function
- Delegation helper that sets ordinary function `this` to the matched element and passes the match as a second argument (since 0.0.8)
- Batch binding to keep setup code tidy
- Grouped cleanup for lifecycle-based teardown
- Composable modifiers instead of option object juggling
- Zero deps and tiny footprint

### Performance note

This library is a thin wrapper around native `addEventListener`.

- **Direct binding** (`On.click(el, fn)` / `on(el, 'click', fn)`): uses a small wrapper per registration to preserve independent cleanup and the native handler context.
- **`capture` / `passive`**: uses native listener options. **`first` / `once`**: removes the registration before the matching callback and releases its cleanup records.
- **Delegation** (`On.delegate.*`): performs a `closest(selector)` lookup per event. Ideal for reducing listener count, but direct binding is better for extremely hot events like `mousemove`.

Rule of thumb: delegate `click`, `input`, and `submit`; bind directly for high-frequency events.

### Native Node targets

Direct `on()`, `off()`, fluent event binders, and groups support Node.js's native `EventTarget` on Node 18 or later. Use native events and abort signals with native targets. Node has no DOM tree or event propagation; its capture flag still distinguishes listener registrations.

```js
const target = new EventTarget()
const scope = On.group()
scope.capture.event('task:complete')(target, handleComplete)
target.dispatchEvent(new Event('task:complete'))
scope.stop()
```

Delegation requires DOM selector/containment APIs, and hover helpers require the application's mouse-event surfaces. `On.ready()` returns a no-op handle and does not invoke its callback when `document` is unavailable. `EventEmitter` has a different API and is not an `EventTarget` substitute.

### Misc

- Delegation uses `Element.closest()` internally.
- In ordinary delegated function handlers, `this` refers to the matched element; arrows and bound methods retain their normal JavaScript context.
- Browser helpers require modern DOM APIs, `Proxy`, and `WeakMap`; direct native Node targets are supported as described above.
- Listener binders, including `On.ready(fn)`, return a `stop()` function for explicit cleanup.

### Legacy alias

`On.once.*` is available as a backward-compatible alias for `On.first.*`.

---

## License

Licensed under AGPL-3.0 with WATT3D Additional Terms. See [LICENSE](./LICENSE) and [ADDITIONAL_TERMS.md](./ADDITIONAL_TERMS.md). Commercial AI/model-training use requires compliance with those terms or a separate WATT3D license. © WATT3D.
