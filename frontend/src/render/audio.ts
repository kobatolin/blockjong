/**
 * Tiny procedural sound effects. No audio files; the AudioContext is created
 * lazily on the first user gesture so autoplay policies are respected.
 */
export class Sfx {
  private context: AudioContext | null = null
  private enabled = true

  setEnabled(value: boolean): void {
    this.enabled = value
    if (!value) {
      void this.context?.suspend().catch(() => undefined)
    } else {
      void this.context?.resume().catch(() => undefined)
    }
  }

  click(): void {
    this.tone(170, 0.07, 'triangle', 0.025, 0, 145)
  }

  select(): void {
    this.tone(520, 0.12, 'sine', 0.035, 0, 560)
  }

  hint(): void {
    this.tone(720, 0.09, 'sine', 0.03, 0, 760)
  }

  match(): void {
    this.tone(660, 0.12, 'sine', 0.04)
    this.tone(880, 0.18, 'sine', 0.035, 0.075)
  }

  revert(): void {
    this.tone(165, 0.16, 'sawtooth', 0.022, 0, 120)
  }

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.24, 'sine', 0.035, index * 0.085)
    })
  }

  deadlock(): void {
    this.tone(220, 0.24, 'sine', 0.03, 0, 185)
    this.tone(165, 0.34, 'sine', 0.025, 0.12, 140)
  }

  dispose(): void {
    void this.context?.close().catch(() => undefined)
    this.context = null
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null
    if (this.context) {
      if (this.context.state === 'suspended') {
        void this.context.resume().catch(() => undefined)
      }
      return this.context
    }

    const ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!ctor) return null

    try {
      this.context = new ctor()
    } catch {
      return null
    }
    return this.context
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
    endFrequency?: number,
  ): void {
    const context = this.ensureContext()
    if (!context) return

    const start = context.currentTime + delay
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        start + duration,
      )
    }
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.03)
  }
}
