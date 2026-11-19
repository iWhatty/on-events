import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const turn = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const emitData = (recorder, text) => recorder.dispatchEvent(Object.assign(new Event('dataavailable'), {
  data: new Blob([text], { type: 'video/webm' }),
}))
const emitError = (recorder, error) => recorder.dispatchEvent(Object.assign(new Event('error'), { error }))
const eventTypes = ['dataavailable', 'error', 'stop']

function harness({ bindFailure, removeFailure, stopFailure, releaseFailure, constructFailure, startFailure, duringStart } = {}) {
  const controller = new AbortController()
  const calls = { created: 0, started: 0, stopped: 0, ran: 0, released: 0 }
  class Recorder extends EventTarget {
    state = 'inactive'
    mimeType = 'video/webm'
    addEventListener(type, ...args) {
      if (bindFailure?.type === type) throw bindFailure.error
      return super.addEventListener(type, ...args)
    }
    removeEventListener(type, ...args) {
      const result = super.removeEventListener(type, ...args)
      if (removeFailure?.type === type) throw removeFailure.error
      return result
    }
    start() {
      calls.started++
      if (startFailure) throw startFailure
      this.state = 'recording'
      duringStart?.(this, controller)
    }
    stop() {
      calls.stopped++
      this.state = 'inactive'
      if (stopFailure) throw stopFailure
      // Native stop requests delivery; tests explicitly control later events.
    }
  }
  const recorder = new Recorder()
  const options = {
    createRecorder() {
      calls.created++
      if (constructFailure) throw constructFailure
      return recorder
    },
    run() { calls.ran++ },
    release() {
      calls.released++
      if (releaseFailure) throw releaseFailure
    },
    signal: controller.signal,
  }
  function clean() {
    for (const type of eventTypes) assert.equal(getEventListeners(recorder, type).length, 0, type)
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0, 'abort')
    assert.equal(calls.released, 1)
  }
  return { recorder, controller, calls, options, clean }
}

// Bundle the actual copyable example once per entry, replacing only module
// resolution. All events, abort signals and listener inspection remain native.
for (const [entry, library] of [['source', 'src/on-events.js'], ['minified', 'dist/on-events.min.js']]) {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('../examples/async-native-recording.js', import.meta.url))],
    absWorkingDir: root, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2020',
    alias: { 'on-events': fileURLToPath(new URL('../' + library, import.meta.url)) },
  })
  const { recordWithCleanup } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))

  await test(`${entry}: asynchronous native recording recipe`, { timeout: 30_000 }, async t => {
    await t.test('waits for final data and stop before cleanup and blob assembly', async () => {
      const h = harness()
      let settled = false
      const recording = recordWithCleanup(h.options)
      recording.then(() => { settled = true }, () => { settled = true })
      await turn()
      assert.equal(h.calls.stopped, 1)
      assert.equal(h.recorder.state, 'inactive')
      assert.equal(h.calls.released, 0)
      for (const type of eventTypes) assert.equal(getEventListeners(h.recorder, type).length, 1)
      emitData(h.recorder, 'first')
      await turn()
      assert.equal(settled, false)
      assert.equal(h.calls.released, 0)
      emitData(h.recorder, 'last')
      h.recorder.dispatchEvent(new Event('stop'))
      const blob = await recording
      assert.equal(await blob.text(), 'firstlast')
      assert.equal(blob.type, 'video/webm')
      h.clean()
    })

    await t.test('works without a signal and retains chunk MIME type after recorder reset', async () => {
      const h = harness()
      h.options.signal = undefined
      h.recorder.stop = () => {
        h.calls.stopped++
        h.recorder.state = 'inactive'
        h.recorder.mimeType = ''
      }
      const recording = recordWithCleanup(h.options)
      await turn()
      emitData(h.recorder, 'done')
      h.recorder.dispatchEvent(new Event('stop'))
      const blob = await recording
      assert.equal(blob.type, 'video/webm')
      assert.equal(await blob.text(), 'done')
      h.clean()
    })

    for (const phase of ['already aborted', 'before queued work', 'pending work', 'finalization']) {
      await t.test(`cancels ${phase}, releases ownership and ignores late work`, async () => {
        const h = harness()
        const pending = deferred()
        h.options.run = () => { h.calls.ran++; return pending.promise }
        const reason = new Error(phase)
        if (phase === 'already aborted') h.controller.abort(reason)
        const recording = recordWithCleanup(h.options)
        const rejected = assert.rejects(recording, error => error === reason)
        if (phase === 'pending work' || phase === 'finalization') await turn()
        if (phase === 'finalization') {
          pending.resolve()
          await turn()
          assert.equal(h.calls.stopped, 1)
          assert.equal(h.calls.released, 0)
        }
        h.controller.abort(reason)
        await rejected
        h.clean()
        if (phase === 'already aborted') assert.equal(h.calls.created, 0)
        if (phase === 'already aborted' || phase === 'before queued work') assert.equal(h.calls.ran, 0)
        const stops = h.calls.stopped
        pending.resolve()
        emitData(h.recorder, 'late')
        h.recorder.dispatchEvent(new Event('stop'))
        await turn()
        assert.equal(h.calls.stopped, stops)
        h.clean()
      })
    }

    await t.test('preserves a falsy cancellation reason', async () => {
      const h = harness()
      const recording = recordWithCleanup(h.options)
      h.controller.abort(0)
      const reason = await recording.then(() => assert.fail('must reject'), error => error)
      assert.equal(reason, 0)
      h.clean()
    })

    for (const type of eventTypes) {
      await t.test(`rolls back failure registering ${type} without starting or rendering`, async () => {
        const failure = new Error('registration failed')
        const h = harness({ bindFailure: { type, error: failure } })
        h.options.run = () => { h.calls.ran++; return new Promise(() => {}) }
        await assert.rejects(recordWithCleanup(h.options), error => error === failure)
        assert.equal(h.calls.started, 0)
        assert.equal(h.calls.ran, 0)
        assert.equal(h.calls.stopped, 0)
        h.clean()
      })
    }

    await t.test('rolls back recorder bindings when abort binding fails', async () => {
      const failure = new Error('abort binding failed'), h = harness()
      h.controller.signal.addEventListener = () => { throw failure }
      await assert.rejects(recordWithCleanup(h.options), error => error === failure)
      assert.equal(h.calls.started, 0)
      assert.equal(h.calls.ran, 0)
      h.clean()
    })

    for (const phase of ['construct', 'start', 'run', 'recorder', 'premature stop', 'premature stop request', 'empty final data']) {
      await t.test(`cleans up after ${phase} failure`, async () => {
        const failure = new Error(phase)
        const h = harness({
          constructFailure: phase === 'construct' ? failure : undefined,
          startFailure: phase === 'start' ? failure : undefined,
          duringStart: phase === 'recorder' ? recorder => emitError(recorder, failure) : undefined,
        })
        if (phase === 'run') h.options.run = () => { throw failure }
        if (phase.startsWith('premature stop')) h.options.run = recorder => {
          recorder.stop()
          if (phase === 'premature stop') recorder.dispatchEvent(new Event('stop'))
        }
        const recording = recordWithCleanup(h.options)
        const rejection = assert.rejects(recording, phase.startsWith('premature stop') ? /before finalization/ : phase === 'empty final data' ? /no data/ : error => error === failure)
        if (phase === 'empty final data') {
          await turn()
          h.recorder.dispatchEvent(new Event('stop'))
        }
        await rejection
        h.clean()
      })
    }

    await t.test('recorder failure during finalization rejects instead of returning partial data', async () => {
      const h = harness(), failure = new Error('finalization failed')
      const recording = recordWithCleanup(h.options)
      const rejected = assert.rejects(recording, error => error === failure)
      await turn()
      assert.equal(h.calls.stopped, 1)
      emitData(h.recorder, 'partial')
      emitError(h.recorder, failure)
      await rejected
      h.recorder.dispatchEvent(new Event('stop'))
      h.clean()
    })

    await t.test('recorder failure interrupts pending work and handles its late rejection', async () => {
      const h = harness(), pending = deferred(), failure = new Error('recorder failed')
      h.options.run = () => pending.promise
      const recording = recordWithCleanup(h.options)
      const rejected = assert.rejects(recording, error => error === failure)
      await turn()
      emitError(h.recorder, failure)
      await rejected
      pending.reject(new Error('late work failure'))
      await turn()
      h.clean()
    })

    await t.test('resource release survives teardown failure and all error identities are retained', async () => {
      const primary = new Error('render'), stopping = new Error('stop'), removal = new Error('remove'), release = new Error('release')
      const h = harness({ stopFailure: stopping, removeFailure: { type: 'dataavailable', error: removal }, releaseFailure: release })
      h.options.run = () => { throw primary }
      await assert.rejects(recordWithCleanup(h.options), error => {
        assert.ok(error instanceof AggregateError)
        assert.deepEqual(error.errors, [primary, stopping, removal, release])
        return true
      })
      h.clean()
    })

    await t.test('reports teardown failure after success while still releasing the resource', async () => {
      const removal = new Error('remove'), h = harness({ removeFailure: { type: 'dataavailable', error: removal } })
      const recording = recordWithCleanup(h.options)
      const rejected = assert.rejects(recording, error => error === removal)
      await turn()
      emitData(h.recorder, 'done')
      h.recorder.dispatchEvent(new Event('stop'))
      await rejected
      h.clean()
    })

    await t.test('retains registration and teardown failures without skipping resource release', async () => {
      const binding = new Error('binding'), removal = new Error('remove')
      const h = harness({ bindFailure: { type: 'error', error: binding }, removeFailure: { type: 'dataavailable', error: removal } })
      await assert.rejects(recordWithCleanup(h.options), error => {
        assert.ok(error instanceof AggregateError)
        assert.deepEqual(error.errors, [binding, removal])
        return true
      })
      assert.equal(h.calls.started, 0)
      h.clean()
    })
  })
}
