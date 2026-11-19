# on-events 0.0.10 downstream update

Hi Wave Dots, SpellBolt, Prism, Photon Lab, and downstream teams — **on-events `0.0.10` is live on npm**, tagged `latest`:

[**npm: on-events 0.0.10**](https://www.npmjs.com/package/on-events/v/0.0.10)

- **Async native EventTarget example:** The package now includes a [copyable MediaRecorder lifecycle recipe](https://github.com/iWhatty/on-events/blob/e3fb8458a35f8b7d2afae46cb9cb3dc9f0f70a67/examples/async-native-recording.js), following Wave Dots' feedback. It uses existing `on()` and `On.group()` APIs to own data/error/stop listeners, wait for final asynchronous data, compose cancellation with pending work, and roll back partial registration before recording starts. [Usage and ownership notes](https://github.com/iWhatty/on-events/blob/e3fb8458a35f8b7d2afae46cb9cb3dc9f0f70a67/README.md#asynchronous-native-eventtarget-lifetimes).
- **Example fixes:** Resource release is awaited, including async failures, and later cancellation cannot skip required cleanup. Primary and cleanup errors retain their identities and order. Required callbacks are validated before startup, and untyped chunks retain the recorder's pre-stop MIME fallback.
- **Verification passed:** Full release gate: 126 DOM tests per entry, 36 native cleanup checks, 64 async-example checks, 15 compiler tests, and TypeScript validation. A fresh npm install, compiled consumers for both exports, and 12 real Chromium MediaRecorder cases also passed. All 15 published files match the reviewed build.

Copy the recipe into your application and adapt its recording policy. Rendering deadlines, codec support, UI restoration, and cooperative cancellation of already-running work remain application responsibilities. The browser checks establish lifecycle cleanup and final-data delivery; they do not establish decoded video fidelity or cross-browser codec coverage.
