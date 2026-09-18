// Tap vs. long-press on one element, with the same feel as the ingredient tiles.
const LONG_PRESS_MS = 450
const MOVE_TOLERANCE = 10

export function usePress(onTap: () => void, onLong: () => void) {
  let timer: number | undefined
  let startX = 0
  let startY = 0
  let done = false

  return {
    pointerdown(e: PointerEvent) {
      done = false
      startX = e.clientX
      startY = e.clientY
      timer = window.setTimeout(() => {
        done = true
        onLong()
      }, LONG_PRESS_MS)
    },
    pointermove(e: PointerEvent) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) {
        done = true
        clearTimeout(timer)
      }
    },
    pointerup() {
      clearTimeout(timer)
    },
    pointercancel() {
      clearTimeout(timer)
      done = true
    },
    click() {
      if (!done) onTap()
    },
    contextmenu(e: Event) {
      e.preventDefault()
    },
  }
}
