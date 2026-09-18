<script setup lang="ts">
import { state } from '../store'
import EffectIcon from './EffectIcon.vue'
import { GOALS } from '../types'

// The effects to cook for, as in-game status icons. Tap picks the goal.
const s = state.settings
</script>

<template>
  <nav class="goals" aria-label="Cook for">
    <button
      v-for="g in GOALS"
      :key="g.key"
      class="goal"
      :class="{ on: s.goal === g.key }"
      :aria-label="g.label"
      :aria-pressed="s.goal === g.key"
      @click="s.goal = g.key"
    >
      <EffectIcon :kind="g.key" />
    </button>
  </nav>
</template>

<style scoped>
.goals {
  display: grid;
  /* Two rows of six: big enough to hit with a finger, never under 48px. */
  grid-template-columns: repeat(6, minmax(48px, 1fr));
  gap: 8px;
}
/* Same look as the inventory slots: dark, slightly transparent, inset border. */
.goal {
  aspect-ratio: 1;
  padding: 20%;
  border: none;
  border-radius: 3px;
  background: rgba(12, 12, 12, 0.62);
  outline: 2px solid rgba(150, 150, 150, 0.35);
  outline-offset: -4px;
  display: grid;
  place-items: center;
  opacity: 0.55;
  transition:
    opacity 0.15s,
    outline-color 0.15s,
    box-shadow 0.2s;
}
.goal.on {
  opacity: 1;
  outline-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.35);
}
.goal :deep(.effect-icon) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
