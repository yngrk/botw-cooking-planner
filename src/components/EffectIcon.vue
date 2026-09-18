<script setup lang="ts">
import type { GoalKey } from '../types'

// In-game status icon for a goal / dish effect. The effect PNGs are Nintendo
// artwork in public/icons/effects/ (scripts/fetch-effect-icons.py); hearts and
// extra hearts are our own SVG hearts, the wiki only has tiny ones.
defineProps<{ kind: GoalKey }>()

const HEART_COLOR: Partial<Record<GoalKey, string>> = { hearts: '#ec2d2d', hearty: '#f5d33b' }
</script>

<template>
  <svg v-if="HEART_COLOR[kind]" class="effect-icon" viewBox="0 0 24 22" aria-hidden="true">
    <path :fill="HEART_COLOR[kind]" d="M12 21.2 2.6 12.1A5.9 5.9 0 0 1 12 4.6a5.9 5.9 0 0 1 9.4 7.5Z" />
  </svg>
  <img v-else class="effect-icon" :src="`/icons/effects/${kind}.png`" alt="" draggable="false" />
</template>

<style scoped>
.effect-icon {
  width: 1em;
  height: 1em;
  object-fit: contain;
  vertical-align: -0.14em;
  flex: none;
}
</style>
