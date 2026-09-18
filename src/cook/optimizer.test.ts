import { describe, expect, it } from 'vitest'
import { INGREDIENTS } from '../data'
import { GOALS } from '../types'
import { bestDish, planDishes, type PlanSettings } from './optimizer'

const settings = (over: Partial<PlanSettings> = {}): PlanSettings => ({
  goal: 'hearts',
  maxHearts: 3,
  maxStamina: 5,
  allowRare: false,
  includeElixirs: true,
  ...over,
})

const ids = (d: { entries: { item: { id: string }; count: number }[] } | null) =>
  Object.fromEntries(d?.entries.map((e) => [e.item.id, e.count]) ?? [])

describe('optimizer', () => {
  it('heals exactly to full with the cheapest ingredients', () => {
    const d = bestDish({ apple: 31, 'raw-gourmet-meat': 2 }, settings())
    // 3 apples = 3 hearts; no need to spend gourmet meat on 3 max hearts.
    expect(ids(d)).toEqual({ apple: 3 })
    expect(d!.life).toBe(12)
  })

  it('uses stronger food when the heart container is bigger', () => {
    const d = bestDish({ apple: 31, 'raw-gourmet-meat': 2 }, settings({ maxHearts: 20 }))
    // Everything fits in one pot: 2 gourmet meat (2×24) + 3 apples (3×4) quarter hearts.
    expect(ids(d)).toEqual({ 'raw-gourmet-meat': 2, apple: 3 })
    expect(d!.life).toBe(60)
  })

  it('never mixes conflicting effects into an effect dish', () => {
    const d = bestDish(
      { 'mighty-bananas': 13, 'spicy-pepper': 5, apple: 5 },
      settings({ goal: 'mighty' }),
    )
    expect(d!.effect).toBe('mighty')
    expect(d!.entries.some((e) => e.item.id === 'spicy-pepper')).toBe(false)
  })

  it('makes an elixir from critter + monster part', () => {
    const d = bestDish(
      { 'bladed-rhino-beetle': 5, 'bokoblin-horn': 3 },
      settings({ goal: 'mighty' }),
    )
    expect(d!.kind).toBe('elixir')
  })

  it('skips elixirs when turned off', () => {
    const d = bestDish(
      { 'bladed-rhino-beetle': 5, 'bokoblin-horn': 3 },
      settings({ goal: 'mighty', includeElixirs: false }),
    )
    expect(d).toBeNull()
  })

  it('repeats the best dish and consumes the inventory', () => {
    const plan = planDishes({ apple: 10 }, settings())
    expect(plan[0]).toMatchObject({ times: 3 })
    expect(ids(plan[0].dish)).toEqual({ apple: 3 })
    expect(plan.at(-1)!.dish.entries[0].count).toBe(1) // the tenth apple
  })

  it('stays fast with a huge inventory', () => {
    const inv = Object.fromEntries(INGREDIENTS.map((i) => [i.id, 20]))
    for (const g of GOALS) {
      const t = performance.now()
      planDishes(inv, settings({ goal: g.key, allowRare: true }))
      expect(performance.now() - t, g.key).toBeLessThan(1500)
    }
  })
})
