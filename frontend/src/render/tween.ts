/** Tiny tween manager; avoids pulling in an animation dependency. */

export type Easing = (t: number) => number

export const linear: Easing = (t) => t
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3)
export const easeOutExpo: Easing = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))
export const easeOutBack: Easing = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export interface TweenOptions {
  duration: number
  delay?: number
  ease?: Easing
  onUpdate: (progress: number) => void
  onComplete?: () => void
}

interface Entry extends TweenOptions {
  elapsed: number
  cancelled: boolean
}

export class TweenManager {
  private entries: Entry[] = []

  add(options: TweenOptions): () => void {
    const entry: Entry = {
      ...options,
      delay: options.delay ?? 0,
      ease: options.ease ?? easeOutCubic,
      elapsed: 0,
      cancelled: false,
    }
    this.entries.push(entry)
    return () => {
      entry.cancelled = true
    }
  }

  update(dt: number): void {
    if (this.entries.length === 0) return
    const alive: Entry[] = []
    for (const entry of this.entries) {
      if (entry.cancelled) continue
      entry.elapsed += dt
      const local = entry.elapsed - (entry.delay ?? 0)
      if (local < 0) {
        alive.push(entry)
        continue
      }
      const raw = entry.duration <= 0 ? 1 : Math.min(1, local / entry.duration)
      entry.onUpdate((entry.ease ?? easeOutCubic)(raw))
      if (raw >= 1) {
        entry.onComplete?.()
      } else {
        alive.push(entry)
      }
    }
    this.entries = alive
  }

  clear(): void {
    this.entries = []
  }

  get size(): number {
    return this.entries.length
  }
}
