package com.lifecare.phonecompanion.hardware

import java.util.concurrent.CopyOnWriteArraySet

object HardwareSignalRouter {
  private val listeners = CopyOnWriteArraySet<(HardwareFallSignal) -> Unit>()

  fun register(listener: (HardwareFallSignal) -> Unit) {
    listeners += listener
  }

  fun unregister(listener: (HardwareFallSignal) -> Unit) {
    listeners -= listener
  }

  fun dispatch(signal: HardwareFallSignal) {
    listeners.forEach { listener -> listener(signal) }
  }
}
