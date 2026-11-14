# CHANGELOG — `on-events`

What changed for people using the package, per release. Entries before 0.0.6 were reconstructed from git history.

## Unreleased

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
