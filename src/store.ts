import { reactive, watch } from 'vue'
import type { EffectKey } from './types'

const KEY = 'botw-cooking:v1'

export const DEFAULT_HEARTS = 3
export const MAX_HEARTS = 30
export const DEFAULT_STAMINA = 5 // one full wheel
export const MAX_STAMINA = 15 // three wheels

export interface Settings {
  maxHearts: number
  maxStamina: number // in fifths of a wheel (one stamina vessel each), 5–15
  goal: EffectKey | 'hearts'
  allowRare: boolean
  includeElixirs: boolean
}

interface State {
  inventory: Record<string, number>
  recent: string[] // ids, most recently changed first
  selected: string | null // last tapped ingredient, shown in the info panel
  settings: Settings
  tourDone: boolean // first-visit guided tour finished or skipped
}

const defaults = (): State => ({
  inventory: {},
  recent: [],
  selected: null,
  settings: { maxHearts: DEFAULT_HEARTS, maxStamina: DEFAULT_STAMINA, goal: 'hearts', allowRare: false, includeElixirs: true },
  tourDone: false,
})

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw) as Partial<State>
    const d = defaults()
    const settings = { ...d.settings, ...parsed.settings }
    // Stamina used to be stored in whole wheels (1–3).
    if (settings.maxStamina <= 3) settings.maxStamina *= 5
    return { ...d, ...parsed, settings }
  } catch {
    return defaults()
  }
}

export const state = reactive<State>(load())

watch(
  state,
  (s) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* storage unavailable (private mode) — app still works for the session */
    }
  },
  { deep: true },
)

export const MAX_COUNT = 999

export function count(id: string) {
  return state.inventory[id] ?? 0
}

export function setCount(id: string, n: number) {
  const v = Math.max(0, Math.min(MAX_COUNT, Math.round(n)))
  if (v === 0) delete state.inventory[id]
  else state.inventory[id] = v
  state.recent = [id, ...state.recent.filter((r) => r !== id)].slice(0, 12)
}

export function addCount(id: string, delta: number) {
  setCount(id, count(id) + delta)
}

export function clearInventory() {
  state.inventory = {}
  state.recent = []
  state.selected = null
}

/** Removes a cooked dish's ingredients without touching selection or recents. */
export function consume(entries: { item: { id: string }; count: number }[]) {
  for (const { item, count: n } of entries) {
    const v = count(item.id) - n
    if (v > 0) state.inventory[item.id] = v
    else delete state.inventory[item.id]
  }
}
