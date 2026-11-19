import { on, On } from 'on-events'

// Application recipe, not a package API. The caller owns recording policy and
// cooperative work cancellation. release() owns the resource and is awaited.
export async function recordWithCleanup({ createRecorder, run, release, signal }) {
  // No resource can be acquired if its required release callback is missing.
  if (typeof release !== 'function') throw new TypeError('release must be a function')
  const listeners = On.group()
  const chunks = []
  const errors = []
  let recorder, blob, finalizing = false
  let failed = false, failure
  let rejectFailure, resolveStopped
  const stopped = new Promise(resolve => { resolveStopped = resolve })
  const failurePending = new Promise((resolve, reject) => { rejectFailure = reject })
  // A native callback can fail during start(), before the first await is reached.
  // Keep that rejection handled even when setup itself exits through a throw.
  failurePending.catch(() => {})

  function fail(error) {
    if (failed) return
    failed = true
    failure = error
    rejectFailure(error)
  }

  function check() {
    if (failed) throw failure
    signal?.throwIfAborted()
  }

  try {
    if (typeof createRecorder !== 'function') throw new TypeError('createRecorder must be a function')
    if (typeof run !== 'function') throw new TypeError('run must be a function')
    check()
    recorder = createRecorder()
    check()

    // Register outside Promise executors: a partial setup failure must throw
    // directly into cleanup, before start() or any rendering can run.
    listeners.add(on(recorder, 'dataavailable', ({ data }) => {
      if (data?.size > 0) chunks.push(data)
    }))
    listeners.add(on(recorder, 'error', ({ error }) => {
      fail(error ?? new Error('MediaRecorder failed'))
    }, { once: true }))
    listeners.add(on(recorder, 'stop', () => {
      if (!finalizing) fail(new Error('Recorder stopped before finalization was requested'))
      else resolveStopped()
    }, { once: true }))
    if (signal) listeners.add(on(signal, 'abort', () => fail(signal.reason), { once: true }))

    check()
    recorder.start()
    check()
    const pendingWork = Promise.resolve().then(() => {
      check() // Cancellation before this microtask must prevent queued work.
      return run(recorder, signal)
    })
    await Promise.race([pendingWork, failurePending])
    check()
    if (recorder.state === 'inactive') throw new Error('Recorder stopped before finalization was requested')

    const recordedType = recorder.mimeType
    finalizing = true
    recorder.stop()
    check()
    // stop() requests finalization. Its final data and stop events can arrive
    // later; keep listeners and the resource alive until that delivery ends.
    await Promise.race([stopped, failurePending])
    check()
    // A recorder can reset mimeType while becoming inactive. Prefer the type
    // carried by actual recorded data rather than its post-stop state.
    blob = new Blob(chunks, { type: chunks.find(data => data.type)?.type || recordedType })
    if (blob.size === 0) throw new Error('Recorder produced no data')
  } catch (error) {
    errors.push(error)
  } finally {
    // Every cleanup is attempted. Cleanup failures cannot hide the primary
    // failure or prevent resource release, including after partial registration.
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop()
    } catch (error) { errors.push(error) }
    try { listeners.stop() } catch (error) { errors.push(error) }
    // Do not race cleanup against cancellation: owned resources must finish
    // releasing even if the signal is aborted while cleanup is pending.
    try { await release() } catch (error) { errors.push(error) }
  }

  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, 'Recording or cleanup failed')
  return blob
}
