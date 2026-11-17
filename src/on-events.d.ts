// src/on-events.d.ts

export type Stop = () => void

export type Handler<E extends Event = Event> = (this: Element, ev: E, matchedElement: Element) => any
export type DirectHandler<E extends Event = Event> = (ev: E) => any

export type BatchMap = Record<
  string,
  | DirectHandler<any>
  | [string, Handler<any>]
>

// --- Low-level API ---

export function on<E extends Event = Event>(
  el: EventTarget,
  event: string,
  handler: DirectHandler<E>,
  options?: AddEventListenerOptions | boolean
): Stop

export function on<E extends Event = Event>(
  el: Element | Document,
  event: string,
  selector: string,
  handler: Handler<E>,
  options?: AddEventListenerOptions | boolean
): Stop

export function off<E extends Event = Event>(
  el: EventTarget,
  event: string,
  handler: DirectHandler<E>,
  selector?: null
): void

export function off<E extends Event = Event>(
  el: Element | Document,
  event: string,
  handler: Handler<E>,
  selector?: string
): void

// --- Fluent Event Binder ---

export type EventBinder<E extends Event = Event, Delegated extends boolean = false> =
  Delegated extends true
    ? (el: Element | Document, selector: string, handler: Handler<E>) => Stop
    : (el: EventTarget, handler: DirectHandler<E>) => Stop

// --- Fluent Chain API core ---

type DOMEventMap = GlobalEventHandlersEventMap & DocumentEventMap & WindowEventMap

interface ChainModifiers<Delegated extends boolean> {
  first: OnChain<Delegated>
  once: OnChain<Delegated>
  capture: OnChain<Delegated>
  passive: OnChain<Delegated>
  delegate: OnChain<true>

  hover(
    el: Element,
    enter: (ev: MouseEvent) => any,
    leave: (ev: MouseEvent) => any
  ): Stop

  batch(
    el: EventTarget,
    map: BatchMap
  ): Stop

  ready(fn: () => void): Stop

  event<K extends keyof DOMEventMap>(
    type: K
  ): EventBinder<DOMEventMap[K], Delegated>
  event<E extends Event = Event>(type: string): EventBinder<E, Delegated>
}

export type OnEventMap<Delegated extends boolean = false> = {
  [K in keyof DOMEventMap]:
    EventBinder<DOMEventMap[K], Delegated>
}

export type OnChain<Delegated extends boolean = false> =
  ChainModifiers<Delegated> & OnEventMap<Delegated>

export type OnAPI = OnChain & {
  group(): OnGroup
}

export type OnGroup = OnChain & {
  stop(): void
  /** Returns the original cleanup. Manual calls do not remove its scope entry. */
  add<T extends Stop | null | undefined | false>(stop: T): T
  /** Returns a once-only disposer that removes its scope entry before cleanup. */
  defer(cleanup: Stop): Stop
}

export const On: OnAPI
