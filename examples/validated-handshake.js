// Application recipe, not an exported on-events API. Supply a trusted peer/origin
// and an application session identifier. A session correlates requests; it does
// not authenticate scripts running in the same page.
export function startValidatedHandshake(owner, {
  receiver,
  peer,
  origin,
  session,
  load,
  onReady,
  onError,
  timeoutMs = 30_000,
}) {
  let phase = 'waiting'
  let timer
  let stopMessage = () => {}
  const controller = new AbortController()

  // Remain owned until loading completes, even after the message is accepted.
  const finish = owner.defer(() => {
    phase = 'done'
    stopMessage()
    clearTimeout(timer)
    controller.abort()
  })

  try {
    stopMessage = owner.message(receiver, async (event) => {
      const data = event.data
      if (phase !== 'waiting' || event.source !== peer || event.origin !== origin) return
      if (!data || typeof data !== 'object' || data.type !== 'viewer:ready' || data.session !== session) return

      phase = 'loading'
      stopMessage()
      clearTimeout(timer)

      let result
      try {
        result = await load(controller.signal)
      } catch (error) {
        if (phase !== 'loading') return
        finish()
        onError(error)
        return
      }
      // Aborting work is cooperative. Guard completion even if load ignores it.
      if (phase !== 'loading') return
      finish()
      onReady(result)
    })
    timer = setTimeout(() => {
      if (phase !== 'waiting') return
      finish()
      onError(new Error('Handshake timed out'))
    }, timeoutMs)
  } catch (error) {
    finish()
    throw error
  }

  return finish
}
