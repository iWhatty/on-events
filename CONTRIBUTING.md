# Maintaining the listener contract

Keep ownership logic in the shared primitives in `src/on-events.js`:

- `bind()` owns every DOM registration. Classic bindings, fluent events, batches, hover, and pending ready callbacks enter this same path.
- `createDisposer()` owns the once-only guard and removal from a cleanup scope. It detaches the owner and clears its stored callback before invoking cleanup, including when cleanup throws or reenters teardown.
- `eventBinder()` binds explicit event strings. Custom names and batch keys must bypass proxy helper lookup so names such as `capture`, `event`, and `defer` remain usable as events.
- Modifier proxies carry flags and the same cleanup scope. Root controls are concrete properties of the root target; they do not become controls on modifier chains.

Preserve these observable contracts:

- Each binding owns an independent, idempotent stop handle. Explicit `off()` removes every matching registration.
- A successful delegated match is computed once, checked against the root, and passed as both ordinary-function `this` and the second callback argument. Bound methods and arrows keep normal JavaScript context. Direct callbacks receive only the event.
- Delegated once listeners survive misses and stop before invoking the first matching callback. Once completion and abort release registration records and scope entries.
- `group.add()` returns the original function, suppresses duplicate pending identities, and passes through nullish/false inputs. It does not intercept manual calls.
- `group.defer()` creates an independent disposer per call. Calling that returned handle completes and unregisters the entry before cleanup runs.
- `group.stop()` attempts its current pending batch, reports failures after the other cleanups run, and permits reuse. Work registered during teardown belongs to the next batch.
- Cleanup is synchronous. Application work needs explicit cancellation and guards before applying asynchronous results.

## Verification

Install dependencies and run the existing release gate:

```sh
npm ci
npm run prepublishOnly
```

The gate runs the runtime suite against source and rebuilt minified output, then checks valid and invalid TypeScript usage. Extend these suites when changing a contract; avoid adding alternate binding or cleanup paths to accommodate one helper.

The executable handshake recipe in `examples/validated-handshake.js` is covered by `Testing/handshake.test.js`. Keep its source/origin/session checks, timeout, and late-result guards in the application example rather than adding application policy to the binding core.

Before a release, inspect `npm pack --dry-run` and verify the packed artifact from a separate consumer project. Coordinate installed-browser acceptance with downstream extension projects; DOM simulation does not replace their browser lifecycle checks.
