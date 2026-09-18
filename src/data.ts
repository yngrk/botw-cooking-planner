import type { EffectKey } from './types'

import raw from '../data/ingredients.json'

/** One cookable item. Units and meaning of each field: docs/cooking-rules.md §0. */
export interface Ingredient {
  id: string
  nameDe: string
  nameEn: string
  sortOrder: number
  category: string
  effect: EffectKey | null
  effectLevel: number
  /** Raw quarter hearts; cooking doubles it. */
  hp: number
  effectBaseTime: number | null
  timeBoost: number
  timeBoostScope: 'once-per-distinct' | 'per-item' | null
  hpBoost: number
  critChance: number
  sellPrice: number
  cookTags: string[]
  isCritter: boolean
  isMonsterPart: boolean
  isDragonPart: boolean
  isFairy: boolean
  isMonsterExtract: boolean
  isInedible: boolean
  rare: boolean
}

export const INGREDIENTS: Ingredient[] = (raw as Ingredient[])
  .slice()
  .sort((a, b) => a.sortOrder - b.sortOrder)

export const BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]))

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  fruit: { label: 'Fruit', icon: '🍎' },
  mushroom: { label: 'Mushrooms', icon: '🍄' },
  vegetable: { label: 'Vegetables and herbs', icon: '🥕' },
  meat: { label: 'Meat', icon: '🍖' },
  fish: { label: 'Fish', icon: '🐟' },
  seafood: { label: 'Seafood', icon: '🦀' },
  spice: { label: 'Spices and ingredients', icon: '🧂' },
  mineral: { label: 'Minerals', icon: '💎' },
  critter: { label: 'Critters', icon: '🦋' },
  'monster-part': { label: 'Monster parts', icon: '🦴' },
  'dragon-part': { label: 'Dragon parts', icon: '🐉' },
  special: { label: 'Special', icon: '✨' },
}

export const categoryInfo = (c: string) => CATEGORY_LABELS[c] ?? { label: c, icon: '•' }

export const CATEGORIES = [...new Set(INGREDIENTS.map((i) => i.category))]
