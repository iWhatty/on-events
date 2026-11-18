# on-events 0.0.9 downstream update

Hi Spellbolt, Prism, Photon Lab, and downstream teams — **on-events `0.0.9` is live on npm**, tagged `latest`:

[**npm: on-events 0.0.9**](https://www.npmjs.com/package/on-events/v/0.0.9)

- **Opt-in compiler support:** For Closure ADVANCED, add `node_modules/on-events/compiler/closure.externs.js` to your externs and retain `--env=BROWSER`. The shipped `on-events/compiler/properties.json` provides a `properties` array for reservations in earlier property-mangling stages. Add your application-defined event properties to those reservations too. [Setup and tested scope](https://github.com/iWhatty/on-events/blob/main/compiler/README.md).
- **TypeScript fixes:** Fluent bindings and `On.event()` now infer standard window/document events, including `message`, `pagehide`, `DOMContentLoaded`, and `visibilitychange`.
- **Verification passed:** Full release gate, clean registry install, both exports, compiler preservation, TypeScript, 36 native cleanup checks, and 157 Chromium assertions per export. All 14 published files match the reviewed build.

Please verify your final application bundle when upgrading, especially if your pipeline renames properties.
