// Finds the best dishes for a goal from the inventory. Exhaustive search over a
// small, goal-specific pool of candidate ingredients, then greedy: best dish,
// as often as the inventory allows, then the next best from what's left.
import { INGREDIENTS, type Ingredient } from '../data'
import type { GoalKey } from '../types'
import { cook, isTimed, type Dish, type Entry } from './engine'

export interface PlanSettings {
  goal: GoalKey
  maxHearts: number
  /** Fifths of a wheel. */
  maxStamina: number
  allowRare: boolean
  includeElixirs: boolean
}

export interface PlanStep {
  dish: Dish
  /** How many times to cook it. */
  times: number
}

const MAX_ITEMS = 5
/** Distinct pool ingredients per role; keeps the search at a few thousand dishes. */
const TOP = { effect: 6, filler: 3, spice: 3, monster: 2 }

type Inventory = Record<string, number>

const top = (items: Ingredient[], n: number, by: (i: Ingredient) => number) =>
  items
    .slice()
    .sort((a, b) => by(b) - by(a) || a.sellPrice - b.sellPrice)
    .slice(0, n)

function usable(item: Ingredient, s: PlanSettings) {
  if (item.isInedible || item.isMonsterExtract) return false // rock-hard / random result
  if (item.rare && !s.allowRare) return false
  if ((item.isCritter || item.isMonsterPart) && (!s.includeElixirs || s.goal === 'hearts')) return false
  return true
}

/** Ingredients worth trying for the goal; everything else can't improve the dish. */
function candidatePool(inv: Inventory, s: PlanSettings): Ingredient[] {
  const owned = INGREDIENTS.filter((i) => (inv[i.id] ?? 0) > 0 && usable(i, s))
  const food = owned.filter((i) => !i.isCritter && !i.isMonsterPart)
  const neutral = food.filter((i) => !i.effect)

  if (s.goal === 'hearts') {
    return [
      ...top(food.filter((i) => i.effect !== 'hearty'), 8, (i) => i.hp * 2 + i.hpBoost),
      ...top(food.filter((i) => i.effect === 'hearty'), 3, (i) => i.effectLevel),
    ]
  }

  const pool = top(
    owned.filter((i) => i.effect === s.goal && !i.isMonsterPart),
    TOP.effect,
    (i) => i.effectLevel,
  )
  if (s.goal !== 'hearty') pool.push(...top(neutral, TOP.filler, (i) => i.hp * 2 + i.hpBoost))
  if (isTimed(s.goal)) {
    const spices = neutral.filter((i) => i.timeBoostScope === 'once-per-distinct' && !pool.includes(i))
    pool.push(...top(spices, TOP.spice, (i) => i.timeBoost))
  }
  if (pool.some((i) => i.isCritter)) {
    pool.push(...top(owned.filter((i) => i.isMonsterPart), TOP.monster, (i) => i.timeBoost))
  }
  return [...new Set(pool)].sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Lexicographic score, higher is better; null = doesn't serve the goal. */
function score(d: Dish, s: PlanSettings): number[] | null {
  if (d.kind === 'dubious' || d.kind === 'rock-hard') return null
  const fullHeal = s.maxHearts * 4
  const heal = d.effect === 'hearty' ? fullHeal : Math.min(d.life, fullHeal)
  const cost = -d.entries.reduce((sum, e) => sum + e.item.sellPrice * e.count, 0)
  const items = -d.entries.reduce((sum, e) => sum + e.count, 0)

  if (s.goal === 'hearts') return [heal, cost, items]
  if (d.effect !== s.goal) return null
  switch (s.goal) {
    case 'hearty':
      return [d.vit, cost, items]
    case 'energizing':
      // Restoring more than the stamina wheel holds is wasted.
      return [Math.min(d.vit, s.maxStamina), heal, cost, items]
    case 'enduring':
      return [d.vit, heal, cost, items]
    default:
      return [d.vit, d.time, heal, cost, items]
  }
}

function better(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

export function bestDish(inv: Inventory, s: PlanSettings): Dish | null {
  const pool = candidatePool(inv, s)
  let best: Dish | null = null
  let bestScore: number[] | null = null
  const entries: Entry[] = []

  // Every multiset of 1–5 pool items, respecting owned counts.
  const walk = (start: number, left: number) => {
    if (entries.length) {
      const dish = cook(entries.map((e) => ({ ...e })))
      const sc = score(dish, s)
      if (sc && (!bestScore || better(sc, bestScore))) {
        best = dish
        bestScore = sc
      }
    }
    if (!left) return
    for (let i = start; i < pool.length; i++) {
      const item = pool[i]
      const max = Math.min(left, inv[item.id] ?? 0)
      for (let n = 1; n <= max; n++) {
        entries.push({ item, count: n })
        walk(i + 1, left - n)
        entries.pop()
      }
    }
  }
  walk(0, MAX_ITEMS)
  return best
}

/** Up to `maxSteps` different dishes, each cooked as often as the inventory allows. */
export function planDishes(inventory: Inventory, s: PlanSettings, maxSteps = 6): PlanStep[] {
  const inv = { ...inventory }
  const steps: PlanStep[] = []
  while (steps.length < maxSteps) {
    const dish = bestDish(inv, s)
    if (!dish) break
    const times = Math.min(...dish.entries.map((e) => Math.floor(inv[e.item.id] / e.count)))
    for (const e of dish.entries) inv[e.item.id] -= e.count * times
    steps.push({ dish, times })
  }
  return steps
}
