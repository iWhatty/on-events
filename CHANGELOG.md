# CHANGELOG — `on-events`

What changed for people using the package, per release. Entries before 0.0.6 were reconstructed from git history.

## Unreleased

## 0.0.10 — 2026-11-19

- Added a copyable asynchronous native `EventTarget` recording example that retains listeners through final data delivery, composes cancellation with pending work, rolls back partial registration before startup, and releases resources despite teardown errors. Documented cooperative cancellation and primary/cleanup error precedence, with native regressions for both library entries.
- Hardened the example to await asynchronous resource release and preserve its failures, validate callbacks before startup, and retain the recording MIME type when final chunks are untyped and the recorder resets its type on stop. Cancellation during cleanup cannot skip resource release.

## 0.0.9 — 2026-11-17

- Added opt-in Closure ADVANCED externs and a property-name manifest generated from validated public declarations in an isolated type environment, with guidance for preserving fluent APIs through bundler stages and extending preservation for application-defined event properties.
- Expanded TypeScript event inference to standard document and window events, including `DOMContentLoaded`, `visibilitychange`, `message`, and `pagehide`.
- Added compiler regressions for source and minified entries, including minified bundles, an earlier property-mangling stage, lifecycle helpers, and missing-preservation controls; included the pinned compiler lane in release validation.

## 0.0.8 — 2026-11-16

- Added a first-interaction recipe that retires a group of takeover listeners across event types and targets while preserving the visitor's event, with regression coverage for teardown inside the callback and fresh-scope isolation.
- Documented the fluent API's property-renaming compiler limitation and an explicit `on()` + `group.add()` cleanup recipe, verified with Closure Compiler `20260422.0.0` ADVANCED against the `0.0.8` source. Quoted properties and `on-events/min` alone do not guarantee preservation through a full build pipeline; broader compiler support is deferred to `0.0.9`.
- Fixed captured listener cleanup on native Node.js `EventTarget` by using the options-object removal form. Individual stops, grouped stops, `off()`, and captured once listeners now remove their actual registrations on Node 24.11.1 as well as DOM targets.
- Added a dependency-free native Node regression lane for both source and minified exports, included in prepublish validation alongside the DOM and TypeScript suites. All 36 native checks passed on Node 18.20.8, 20.20.2, 22.23.5, 24.11.1, and 26.13.1.
- Documented native Node target support and a mixed classic/fluent group recipe for passive observers plus an explicitly non-passive capture listener.
- Added `group.defer(cleanup)`, which returns an idempotent disposer that unregisters itself before running cleanup. Completed disposers release their cleanup and owner references, including when cleanup throws.
- Preserved `group.add()` identity, duplicate suppression, and nullish pass-through behavior; documented that manual calls do not remove an `add()` entry from its group.
- Shared the disposer primitive between DOM listener stops and deferred resources so both follow the same ownership and reentrancy rules.
- Added the matched element as a second argument to all delegated callbacks, including classic bindings, batches, custom events, and modifier chains. Ordinary delegated callbacks retain matched-element `this`; bound methods and arrows retain their normal JavaScript context. Direct callbacks still receive one argument.
- Updated TypeScript declarations and regression checks for deferred cleanup, matched elements, bound methods, and event inference through modifier chains.
- Added ownership recipes for stable containers, transient nodes, child scopes, timers, observers, and cancellation of application work.
- Added an executable, tested message-handshake recipe with source/origin/payload/session validation, timeout, owner teardown, independent sessions, duplicate suppression, and guards against late asynchronous results.
- Verified compatibility with WebRadar's six installed-extension production Chromium suites at integration commit `e33770a`, including CSS Inspect and Console Radar listener ownership and teardown.
- Verified the capture-compatibility build with Floppy Bee's 1,194-test app gate, production artifact checks, and real-Chromium tooltip lifecycle and three-viewport smoke at integration commit `f27d2f6`.

## 0.0.7 — 2026-11-13

- Fixed `On.group().stop()` leaving listeners attached when registered through two or more modifiers, such as `group.capture.passive.scroll(...)`.
- Unified classic, fluent, custom-event, batch, hover, and ready bindings behind one registration layer, with group scope carried through every modifier chain.
- Made stop handles idempotent and specific to one registration, preventing shared callbacks and stale handles from removing other listeners. Repeated binding calls now create independent registrations; explicit `off()` still removes all matching registrations.
- Fixed boolean capture options so captured listeners are removed correctly.
- Fixed grouped custom-event factories after modifiers, and allowed explicit custom-event names and batch keys to match fluent helper names.
- Fixed delegated `first` / `once` listeners being consumed by unrelated events; cleanup occurs before the first matching callback, including reentrant dispatches.
- Released listener records, group entries, and abort hooks when listeners stop, fire once, or are aborted; already-aborted signals create no registration.
- Made `On.ready()` return a stop handle so pending callbacks can be cancelled directly or through a group.
- Reworked TypeScript declarations to retain event inference through modifier chains, distinguish direct and delegated binders, and reject unsupported calls and chaining.
- Added lifecycle regression tests and a repeatable TypeScript check, included in prepublish validation.
- Synchronized the package manifest and lockfile versions.

## 0.0.6 — 2026-11-02

- Declares Node 18 or later in `engines`.
- The package's repository link points at the renamed GitHub repo.

## 0.0.5 — 2026-05-20

- With a bundler, the package root resolves to the ES module source; `./min` selects the prebuilt bundle.
- Relicensed to AGPL-3.0 with WATT3D Additional Terms.

## 0.0.4 — 2026-03-18

- `On.group()` collects listeners for one-call teardown; its `stop()` cleans up what it can and reports failures as an `AggregateError`.
- `On.event(type)` binds custom and non-standard event names.
- Delegated handlers handle Text-node event targets.
- Rewritten type declarations for the fluent binders, such as `On.input(el, fn)`, and `on(...)` overloads with listener options.

## 0.0.3 — 2026-02-24

- Improved type declarations.

## 0.0.2 — 2026-02-24

- First npm releases (0.0.1 and 0.0.2): `On.click(el, fn)` style binders with `first`, `once`, `capture`, `passive` and `delegate` modifiers, `batch()`, and the classic `on(...)` / `off(...)`.
