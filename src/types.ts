export type EffectKey =
  | 'hearty'
  | 'energizing'
  | 'enduring'
  | 'chilly'
  | 'spicy'
  | 'electro'
  | 'fireproof'
  | 'mighty'
  | 'tough'
  | 'sneaky'
  | 'hasty'

export type GoalKey = EffectKey | 'hearts'

export interface EffectInfo {
  key: EffectKey
  label: string
  icon: string
  /** Icon of a typical ingredient for this effect (public/icons/<slug>.png). */
  sample: string
}

// In BotW, "chilly" ingredients protect from HEAT and "spicy" ones from COLD.
export const EFFECTS: EffectInfo[] = [
  { key: 'hearty', label: 'Extra Hearts', icon: '💛', sample: 'hearty-radish' },
  { key: 'energizing', label: 'Stamina', icon: '🟢', sample: 'stamella-shroom' },
  { key: 'enduring', label: 'Extra Stamina', icon: '💚', sample: 'endura-carrot' },
  { key: 'spicy', label: 'Cold Resistance', icon: '🌶️', sample: 'spicy-pepper' },
  { key: 'chilly', label: 'Heat Resistance', icon: '❄️', sample: 'chillshroom' },
  { key: 'fireproof', label: 'Flame Guard', icon: '🔥', sample: 'fireproof-lizard' },
  { key: 'electro', label: 'Shock Resistance', icon: '⚡', sample: 'voltfruit' },
  { key: 'mighty', label: 'Attack Up', icon: '⚔️', sample: 'mighty-bananas' },
  { key: 'tough', label: 'Defense Up', icon: '🛡️', sample: 'ironshroom' },
  { key: 'sneaky', label: 'Stealth Up', icon: '🌙', sample: 'silent-princess' },
  { key: 'hasty', label: 'Speed Up', icon: '💨', sample: 'swift-carrot' },
]

export const GOALS: { key: GoalKey; label: string; sample: string }[] = [
  { key: 'hearts', label: 'Hearts', sample: 'raw-prime-meat' },
  ...EFFECTS,
]

export const effectInfo = (key: EffectKey | null | undefined) =>
  EFFECTS.find((e) => e.key === key)
