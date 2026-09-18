import type { Dish } from './cook/engine'
import type { Ingredient } from './data'
import type { EffectKey } from './types'

// Icons live in public/icons/<slug>.png (fetched by scripts/fetch-icons.py).
// The slug comes from the Zelda Wiki file name, which occasionally differs from the in-game English name.
const WIKI_ALIASES: Record<string, string> = {
  'ice-breath-lizalfos-tail': 'icy-lizalfos-tail',
  'fire-breath-lizalfos-tail': 'red-lizalfos-tail',
  'electric-lizalfos-tail': 'yellow-lizalfos-tail',
}

export function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function iconUrl(item: Ingredient) {
  const s = slug(item.nameEn)
  return `${import.meta.env.BASE_URL}icons/${WIKI_ALIASES[s] ?? s}.png`
}

// Dish icons live in public/icons/dishes/<slug>.png (scripts/fetch-dish-icons.py).
// Elixirs look different per effect; the recipe table only calls them "Elixir".
const EFFECT_EN: Record<EffectKey, string> = {
  hearty: 'Hearty',
  energizing: 'Energizing',
  enduring: 'Enduring',
  chilly: 'Chilly',
  spicy: 'Spicy',
  electro: 'Electro',
  fireproof: 'Fireproof',
  mighty: 'Mighty',
  tough: 'Tough',
  sneaky: 'Sneaky',
  hasty: 'Hasty',
}

export function dishIconUrl(dish: Pick<Dish, 'nameEn' | 'effect'>) {
  const name = dish.nameEn === 'Elixir' && dish.effect ? `${EFFECT_EN[dish.effect]} Elixir` : dish.nameEn
  return `${import.meta.env.BASE_URL}icons/dishes/${slug(name)}.png`
}
