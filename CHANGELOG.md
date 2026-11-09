# CHANGELOG — `on-events`

What changed for people using the package, per release. Entries before 0.0.6 were reconstructed from git history.

## Unreleased

- Completed once listeners and aborted listeners release their internal handler records.
- Boolean capture listeners are removed correctly by `stop()` and `off()`.
- Group cleanup tracks all modifier depths and custom event binders.

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
