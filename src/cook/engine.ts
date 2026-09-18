// BotW cooking pot simulation. Follows docs/cooking-rules.md step by step;
// section numbers (§) below refer to that document.
import recipeData from '../../data/recipes.json'
import type { Ingredient } from '../data'
import type { EffectKey } from '../types'

type Alt = { id?: string; tag?: string }
interface Recipe {
  en: string
  de: string
  internal: string
  hb: number
}
interface MultiRecipe extends Recipe {
  slots: Alt[][]
}
interface SingleRecipe extends Recipe {
  match: Alt[]
}

const RECIPES = recipeData.recipes as MultiRecipe[]
const SINGLE_RECIPES = recipeData.singleRecipes as SingleRecipe[]

export type DishKind = 'meal' | 'elixir' | 'fairy-tonic' | 'dubious' | 'rock-hard'

/** Which bonus a critical cook picks (§9). 'none' = no crit happened. */
export type CritBonus = 'none' | 'hearts' | 'vit' | 'time'

export interface Entry {
  item: Ingredient
  count: number
}

export interface Dish {
  kind: DishKind
  nameEn: string
  nameDe: string
  effect: EffectKey | null
  /**
   * Effect strength: level 1–3 for timed effects, 1/5 wheels for energizing and
   * enduring, quarter hearts of yellow hearts for hearty. 0 without effect.
   */
  vit: number
  /** Quarter hearts restored. For hearty dishes: full heal (equals `vit`). */
  life: number
  /** Seconds; 0 for effects without duration. */
  time: number
  /** Crit chance in percent, 0 when a crit can't happen. */
  critChance: number
  /** Monster Extract randomises the result (§10); the numbers are then only a baseline. */
  randomized: boolean
  entries: Entry[]
}

interface Cei {
  bt: number
  /** Multiplier as an exact fraction, so 0.35 × 20 isn't 6.999… (§3). */
  num: number
  den: number
  max: number
  ssa: number
}

const CEI: Record<EffectKey, Cei> = {
  hearty: { bt: 0, num: 1, den: 1, max: 108, ssa: 4 },
  energizing: { bt: 0, num: 7, den: 5, max: 15, ssa: 2 },
  enduring: { bt: 0, num: 1, den: 2, max: 20, ssa: 2 },
  chilly: { bt: 120, num: 7, den: 20, max: 2, ssa: 1 },
  spicy: { bt: 120, num: 7, den: 20, max: 2, ssa: 1 },
  electro: { bt: 120, num: 1, den: 2, max: 3, ssa: 1 },
  fireproof: { bt: 120, num: 3, den: 10, max: 2, ssa: 1 },
  mighty: { bt: 20, num: 9, den: 20, max: 3, ssa: 1 },
  tough: { bt: 20, num: 9, den: 20, max: 3, ssa: 1 },
  sneaky: { bt: 90, num: 7, den: 20, max: 3, ssa: 1 },
  hasty: { bt: 30, num: 9, den: 20, max: 3, ssa: 1 },
}

export const effectCap = (e: EffectKey) => CEI[e].max
export const isTimed = (e: EffectKey | null) => !!e && CEI[e].bt > 0

const MAX_LIFE = 120
const MAX_TIME = 1800
const CRIT_HEARTS = 12
const CRIT_TIME = 300
/** Crit chance bonus by number of distinct ingredients (NMSSR). */
const DISTINCT_CRIT = [5, 10, 15, 20, 25]

const has = (item: Ingredient, tag: string) => item.cookTags.includes(tag)
const matches = (item: Ingredient, alt: Alt) => (alt.id ? item.id === alt.id : has(item, alt.tag!))

/** Groups identical items, keeping first-seen order (§1). */
export function group(items: Ingredient[]): Entry[] {
  const out: Entry[] = []
  for (const item of items) {
    const e = out.find((x) => x.item.id === item.id)
    if (e) e.count++
    else out.push({ item, count: 1 })
  }
  return out
}

// The optimiser cooks the same ingredient sets over and over; matching is the slow part.
const recipeCache = new Map<string, Recipe | null>()

function matchRecipe(entries: Entry[]): Recipe | null {
  const key = entries.map((e) => e.item.id).join(',')
  let r = recipeCache.get(key)
  if (r === undefined) recipeCache.set(key, (r = findRecipe(entries)))
  return r
}

/** §2: first multi recipe whose slots can each take a different entry (greedy), else single fallback. */
function findRecipe(entries: Entry[]): Recipe | null {
  if (entries.length > 1) {
    for (const r of RECIPES) {
      if (r.slots.length > entries.length) continue
      const used = new Set<number>()
      const ok = r.slots.every((slot) => {
        const i = entries.findIndex((e, idx) => !used.has(idx) && slot.some((a) => matches(e.item, a)))
        if (i < 0) return false
        used.add(i)
        return true
      })
      if (ok) return r
    }
  }
  let single: Entry
  if (entries.length === 1) single = entries[0]
  else {
    const nonSpice = entries.filter((e) => !has(e.item, 'CookSpice'))
    if (nonSpice.length !== 1) return null
    single = nonSpice[0]
  }
  return SINGLE_RECIPES.find((r) => r.match.some((a) => matches(single.item, a))) ?? null
}

const DUBIOUS = { en: 'Dubious Food', de: 'Dubiose Matsche' }
const ROCK_HARD = 'Item_Cook_O_02'
const ELIXIR = 'Item_Cook_C_17'
const FAIRY_TONIC = 'Item_Cook_C_16'
const DUBIOUS_ID = 'Item_Cook_O_01'

function kindOf(r: Recipe | null): DishKind {
  switch (r?.internal) {
    case undefined:
    case DUBIOUS_ID:
      return 'dubious'
    case ROCK_HARD:
      return 'rock-hard'
    case ELIXIR:
      return 'elixir'
    case FAIRY_TONIC:
      return 'fairy-tonic'
    default:
      return 'meal'
  }
}

/** Bonuses a crit can pick for this intermediate state (§9). */
function critOptions(effect: EffectKey | null, vit: number, life: number): CritBonus[] {
  if (!effect) return ['hearts']
  if (effect === 'hearty') return ['vit']
  const vitMaxed = vit >= CEI[effect].max
  const hpMaxed = life >= MAX_LIFE
  if (effect === 'energizing' || effect === 'enduring') {
    if (vitMaxed) return ['hearts']
    if (hpMaxed) return ['vit']
    return ['hearts', 'vit']
  }
  if (vitMaxed && hpMaxed) return ['time']
  if (vitMaxed) return ['time', 'hearts']
  if (hpMaxed) return ['time', 'vit']
  return ['hearts', 'vit', 'time']
}

/**
 * Cooks the given items. `crit` forces the crit outcome; when that bonus isn't
 * possible for the dish, the crit is treated as not happening.
 */
export function cook(input: Ingredient[] | Entry[], crit: CritBonus = 'none'): Dish {
  const entries: Entry[] =
    input.length && 'item' in input[0] ? (input as Entry[]) : group(input as Ingredient[])
  const total = entries.reduce((s, e) => s + e.count, 0)
  const recipe = matchRecipe(entries)
  let kind = kindOf(recipe)

  // §3: effect aggregation. Monster parts (CookEnemy) only add time.
  let enemyTime = 0
  let lifeRaw = 0
  const eff = new Map<EffectKey, { count: number; level: number }>()
  for (const { item, count } of entries) {
    if (has(item, 'CookEnemy')) {
      enemyTime += item.timeBoost * count
      continue
    }
    lifeRaw += item.hp * count
    if (item.effect && item.effectLevel > 0) {
      const e = eff.get(item.effect) ?? { count: 0, level: 0 }
      e.count += count
      e.level += item.effectLevel * count
      eff.set(item.effect, e)
    }
  }

  let effect: EffectKey | null = eff.size === 1 ? [...eff.keys()][0] : null
  if (kind === 'fairy-tonic') effect = null
  if (kind === 'elixir' && !effect) kind = 'dubious'

  const randomized = entries.some((e) => e.item.isMonsterExtract)
  const base = { entries, randomized, critChance: 0 }

  if (kind === 'dubious' || kind === 'rock-hard') {
    const dubious = kind === 'dubious'
    return {
      ...base,
      kind,
      nameEn: dubious ? DUBIOUS.en : recipe!.en,
      nameDe: dubious ? DUBIOUS.de : recipe!.de,
      effect: null,
      vit: 0,
      life: dubious ? Math.max(4, lifeRaw) : 1,
      time: 0,
    }
  }

  let vit = 0
  let time = 0
  if (effect) {
    const c = CEI[effect]
    const { count, level } = eff.get(effect)!
    vit = Math.min(c.max, Math.max(1, Math.floor((level * c.num) / c.den)))
    if (c.bt > 0) time = enemyTime + 30 * total + c.bt * count
  }
  let life = lifeRaw * 2

  // §9: critical cook. Monster Extract replaces it with its own randomisation (§10).
  let critChance = 0
  if (!randomized) {
    const best = Math.max(...entries.map((e) => e.item.critChance))
    critChance = Math.min(100, best + DISTINCT_CRIT[entries.length - 1])
    if (crit !== 'none' && critOptions(effect, vit, life).includes(crit)) {
      if (crit === 'hearts') life += CRIT_HEARTS
      else if (crit === 'vit') vit += CEI[effect!].ssa
      else time += CRIT_TIME
    }
  }

  // §11: spices add their bonus once per distinct entry; then the recipe bonus.
  for (const { item } of entries) {
    if (!has(item, 'CookSpice') || has(item, 'CookEnemy')) continue
    life += item.hpBoost
    if (item.timeBoostScope === 'once-per-distinct') time += item.timeBoost
  }
  life += recipe!.hb

  // §12: final adjustment.
  life = Math.max(0, Math.min(MAX_LIFE, Math.trunc(life)))
  if (!effect) {
    if (life === 0) life = 1
  } else {
    vit = Math.min(vit, CEI[effect].max)
    if (effect === 'hearty') {
      vit = Math.max(4, Math.ceil(vit / 4) * 4)
      life = vit
    }
  }
  time = isTimed(effect) ? Math.max(0, Math.min(MAX_TIME, time)) : 0

  return { ...base, kind, nameEn: recipe!.en, nameDe: recipe!.de, effect, vit, life, time, critChance }
}
