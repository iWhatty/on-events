# Compiler preservation (since 0.0.9)

The fluent API uses property names as event names and modifier commands. Property-renaming compilers must preserve that protocol in both the library and its callers. Ordinary identifier/whitespace minification does not require these files.

The package includes two build-time artifacts:

- `on-events/compiler/closure.externs.js`: Closure Compiler declarations for the public export, helper, modifier, group-control, and standard DOM event names.
- `on-events/compiler/properties.json`: the same names as a JSON `properties` array for a build tool's reservation settings. `schemaVersion` is `1`.

Both are generated from the public TypeScript declarations, including the global-handler, document, and window event maps. They add no runtime code or runtime dependency. The list covers declared standard events; application-defined event properties need application preservation.

## Closure Compiler ADVANCED

Bundle the selected library entry together with its consumer, then pass the externs to the ADVANCED compilation. Keep the BROWSER environment so native DOM properties and listener option keys retain their meaning. A Node build script can resolve the shipped file without assuming a flat dependency layout:

```js
import { fileURLToPath } from 'node:url'

const externs = fileURLToPath(import.meta.resolve('on-events/compiler/closure.externs.js'))
// Add externs to your compiler's existing externs list.
```

For a command-line build with the default dependency layout:

```sh
npm install --save-dev --save-exact google-closure-compiler@20260422.0.0
npx google-closure-compiler --js=dist/app.js --externs=node_modules/on-events/compiler/closure.externs.js --compilation_level=ADVANCED --env=BROWSER --language_in=ECMASCRIPT_NEXT --language_out=ECMASCRIPT_2020 --js_output_file=dist/app.advanced.js
```

`dist/app.js` must already contain the application and the selected `on-events` entry. Install and pin the compiler in your build project; the regression suite uses `google-closure-compiler@20260422.0.0`. The `import.meta.resolve` example uses modern Node tooling; this does not change the library's Node 18 runtime support.

Externs preserve names globally during that compiler invocation and can reduce renaming opportunities on unrelated objects sharing those names. They describe property preservation, not Closure type signatures for the complete fluent API. See [Closure's externs documentation](https://developers.google.com/closure/compiler/docs/externs-and-exports).

## Earlier property-mangling stages

Closure externs cannot restore a property name that an earlier bundler already changed. Reserve the same names in every preceding property-mangling stage. For example, in an esbuild configuration:

```js
import { readFile } from 'node:fs/promises'

const { properties } = JSON.parse(await readFile(
  new URL(import.meta.resolve('on-events/compiler/properties.json')), 'utf8',
))
const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const additionalProperties = [] // Your custom event keys and other public/native names.
const reserved = [...properties, ...additionalProperties]
const reserveProps = new RegExp(`^(?:${reserved.map(escape).join('|')})$`)

// Add reserveProps to the existing esbuild build options when using mangleProps.
// Include your application's other public/native reservations in that policy.
```

This JSON list is the on-events contract, not an inventory of every DOM, JavaScript, or application property. Do not turn on unrestricted property mangling based on this list alone. See [esbuild's property-mangling guidance](https://esbuild.github.io/api/#mangle-props).

## Application-defined event names

Prefer explicit strings for custom events:

```js
const group = On.group()
group.event('taskdone')(target, handleTask)
group.add(on(target, 'taskdone', handleTask))
```

If an application uses `group.taskdone(...)` or `group.batch(target, { taskdone: handler })`, reserve `taskdone` as well. For Closure, add an application extern file alongside the package externs:

```js
/** @externs */
/** @constructor */
function ApplicationEvents() {}
ApplicationEvents.prototype.taskdone;
```

Add those application names to earlier stages' reservations too. Quoting an identifier-shaped batch key or fluent property alone is insufficient: a bundler may rewrite quoted access before a later compiler renames it. Importing `on-events/min` does not protect names from subsequent property renaming.

## Verified scope

`npm run test:compiler` bundles both the source and minified entries with a real DOM consumer, then compiles each with Closure ADVANCED, the BROWSER environment, and the shipped externs. It checks plain bundles, minified bundles, and a preceding esbuild property-mangling pass with the reservations applied. Application-private properties still get renamed in that pass.

The consumer uses static fluent access for every declared standard event name so the accesses themselves pass through property renaming. It also checks nested modifiers, delegation and its matched argument, once/reentrant dispatch, custom events, batches, hover, ready, group ownership, classic `on`/`off`, and abort options. Probes verify matching native registration/removal identities and report unexpected runtime errors as failures. Negative controls reproduce the original missing-externs failure and show that application event properties need preservation in both the bundler and Closure stages.

This is a tested configuration, not a guarantee for arbitrary compiler versions or pipelines. Separately compiled modules and external namespaces need their own linking/export contract; that boundary is outside this matrix. Keep the explicit `on()` + `group.add()` recipe when a build cannot preserve the fluent protocol, and verify the final application artifact.
