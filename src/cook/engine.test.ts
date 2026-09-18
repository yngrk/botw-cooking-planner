import { describe, expect, it } from 'vitest'
import { BY_ID, type Ingredient } from '../data'
import md from '../../docs/cooking-rules.md?raw'
import { cook, type CritBonus } from './engine'

// The worked examples in docs/cooking-rules.md §14 are the test cases.
const section = md.slice(md.indexOf('## 14.'), md.indexOf('## A.'))
const rows = section
  .split('\n')
  .filter((l) => /^\| \d+ \|/.test(l))
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))

const num = (cell: string) => {
  const m = cell.match(/^\d+/)
  return m ? Number(m[0]) : 0
}

function items(spec: string): Ingredient[] {
  return spec.split(', ').flatMap((part) => {
    const [, id, n] = part.match(/^([\w-]+)(?: ×(\d+))?$/)!
    const item = BY_ID.get(id)
    if (!item) throw new Error(`unknown ingredient ${id}`)
    return Array<Ingredient>(Number(n ?? 1)).fill(item)
  })
}

describe('cooking-rules.md §14 worked examples', () => {
  for (const [nr, ingredients, crit, result, effect, vit, life, time] of rows) {
    // Row 34 lists several single-ingredient cases separated by " / ".
    const cases = ingredients.includes(' / ')
      ? ingredients.replace(' (alone)', '').split(' / ')
      : [ingredients]
    for (const spec of cases) {
      it(`#${nr} ${spec}${crit === '–' ? '' : ` (crit: ${crit})`}`, () => {
        const dish = cook(items(spec), crit === '–' ? 'none' : (crit as CritBonus))
        const effectKey = effect.startsWith('–') ? null : effect
        const vitValue = dish.effect === 'energizing' ? dish.vit * 200 : dish.vit
        expect({
          name: dish.nameEn,
          effect: dish.effect,
          vit: vitValue,
          life: dish.life,
          time: dish.time,
        }).toEqual({
          name: result,
          effect: effectKey,
          vit: num(vit),
          life: num(life),
          time: num(time),
        })
      })
    }
  }

  it('crit chances quoted in the rules', () => {
    expect(cook(items('apple')).critChance).toBe(5)
    expect(cook(items('goron-spice, voltfin-trout ×2, bird-egg ×2')).critChance).toBe(25)
    expect(
      cook(items('fireproof-lizard, smotherwing-butterfly ×3, bokoblin-guts')).critChance,
    ).toBe(45)
  })
})
