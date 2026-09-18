// Display strings for cooked dishes.
import type { Dish } from './engine'

const QUARTERS = ['', '¼', '½', '¾']
const FIFTHS = ['', '⅕', '⅖', '⅗', '⅘']

/** 13 quarter hearts → "3¼". */
export function hearts(quarters: number) {
  const whole = Math.floor(quarters / 4)
  return `${whole || (quarters % 4 ? '' : 0)}${QUARTERS[quarters % 4]}`
}

/** 8 fifths of a stamina wheel → "1⅗". */
export function wheels(fifths: number) {
  const whole = Math.floor(fifths / 5)
  return `${whole || (fifths % 5 ? '' : 0)}${FIFTHS[fifths % 5]}`
}

/** 750 s → "12:30". */
export function duration(seconds: number) {
  const m = Math.floor(seconds / 60)
  return `${m}:${String(seconds % 60).padStart(2, '0')}`
}

/** The effect part of a dish, e.g. "Lv. 2 · 12:30", "+3 extra hearts", "1⅗ wheels". */
export function effectText(d: Dish): string {
  switch (d.effect) {
    case null:
      return ''
    case 'hearty':
      return `+${d.vit / 4} ${d.vit === 4 ? 'extra heart' : 'extra hearts'}`
    case 'energizing':
      return `${wheels(d.vit)} stamina ${d.vit <= 5 ? 'wheel' : 'wheels'}`
    case 'enduring':
      return `+${wheels(d.vit)} extra ${d.vit <= 5 ? 'wheel' : 'wheels'}`
    default:
      return `Lv. ${d.vit} · ${duration(d.time)}`
  }
}

export function lifeText(d: Dish): string {
  if (d.effect === 'hearty') return 'Full recovery'
  return `${hearts(d.life)} ♥`
}
