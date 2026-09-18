<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Ingredient } from '../data'
import { categoryInfo } from '../data'
import { iconUrl } from '../icons'
import { addCount, count } from '../store'
import EffectIcon from './EffectIcon.vue'

const props = defineProps<{ item: Ingredient }>()
const emit = defineEmits<{ longpress: [id: string] }>()

const n = computed(() => count(props.item.id))
const restoresHearts = computed(() => Number(props.item.hp) > 0)
const iconFailed = ref(false)

const LONG_PRESS_MS = 420
const MOVE_TOLERANCE = 10
// Like iOS in scroll views: show the press only once it's clearly not the start
// of a swipe, so swiping doesn't first sink the tile under the finger.
const PRESS_DELAY_MS = 70
const TAP_FLASH_MS = 110

const pressed = ref(false)
let pressShown = false
let pressTimer: number | undefined
let timer: number | undefined
let startX = 0
let startY = 0
let longPressed = false
let cancelled = false

function onDown(e: PointerEvent) {
  longPressed = false
  cancelled = false
  startX = e.clientX
  startY = e.clientY
  pressShown = false
  pressTimer = window.setTimeout(() => (pressed.value = pressShown = true), PRESS_DELAY_MS)
  timer = window.setTimeout(() => {
    longPressed = true
    emit('longpress', props.item.id)
  }, LONG_PRESS_MS)
}

function onMove(e: PointerEvent) {
  if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) {
    cancelled = true
    clearTimeout(timer)
    release()
  }
}

function release() {
  clearTimeout(pressTimer)
  pressed.value = false
}

function onUp() {
  clearTimeout(timer)
  release()
}

function onTap() {
  if (longPressed || cancelled) return
  addCount(props.item.id, 1)
  flashes.value++
  // A tap quicker than the press delay still gets a short sink-and-spring.
  if (!pressShown) {
    pressed.value = true
    setTimeout(() => (pressed.value = false), TAP_FLASH_MS)
  }
}

// Each tap lights the slot up white, like selecting in the game's inventory
// (a fresh element per tap, so quick taps each replay it).
const flashes = ref(0)

// Retrigger the count "bump" animation on every change.
const bump = ref(0)
watch(n, () => bump.value++)
</script>

<template>
  <div
    class="slot"
    :class="{ owned: n > 0, pressed }"
    role="button"
    :aria-label="`${item.nameEn}, ${n} owned`"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @pointerleave="onUp"
    @click="onTap"
    @contextmenu.prevent
  >
    <img
      v-if="!iconFailed"
      class="icon"
      :src="iconUrl(item)"
      :alt="''"
      draggable="false"
      decoding="async"
      @error="iconFailed = true"
    />
    <span v-else class="icon fallback" aria-hidden="true">{{ categoryInfo(item.category).icon }}</span>
    <EffectIcon v-if="restoresHearts" kind="hearts" class="heart" />
    <span v-if="flashes" :key="flashes" class="flash" aria-hidden="true" />
    <span v-if="n > 0" :key="bump" class="count">x{{ n }}</span>
  </div>
</template>

<style scoped>
/* Matches the in-game Materials slot: near-black square, light grey frame. */
.slot {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--frame-radius);
  /* Slightly see-through like the game, so the world shows faintly behind. */
  background: var(--frame-bg);
  /* The light frame sits a few px inside the slot's edge, like in-game. */
  outline: var(--frame-width) solid var(--frame-line);
  outline-offset: var(--frame-inset);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  container-type: inline-size;
  transition:
    transform 0.28s var(--spring),
    outline-color 0.2s;
}
.slot.pressed {
  transform: scale(0.92);
  transition-duration: 0.06s;
}
.slot.owned {
  outline-color: var(--frame-line-strong);
}
.icon {
  width: 82%;
  height: 82%;
  object-fit: contain;
  pointer-events: none;
  opacity: 0.3;
  filter: saturate(0.3);
  transition:
    opacity 0.2s,
    filter 0.2s;
}
.owned .icon {
  opacity: 1;
  filter: none;
}
.fallback {
  font-size: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.heart {
  position: absolute;
  top: 9%;
  right: 10%;
  font-size: max(12px, 16cqi);
  line-height: 1;
  opacity: 0.35;
}
.owned .heart {
  opacity: 1;
}
.flash {
  position: absolute;
  inset: 0;
  border-radius: var(--frame-radius);
  pointer-events: none;
  outline: var(--frame-width) solid #fff;
  outline-offset: var(--frame-inset);
  animation: tap-flash 0.45s ease-out forwards;
}
@keyframes tap-flash {
  from {
    background: rgba(255, 255, 255, 0.5);
    box-shadow:
      0 0 18px rgba(255, 255, 255, 0.8),
      inset 0 0 18px rgba(255, 255, 255, 0.7);
    opacity: 1;
  }
  to {
    background: rgba(255, 255, 255, 0);
    box-shadow:
      0 0 18px rgba(255, 255, 255, 0),
      inset 0 0 18px rgba(255, 255, 255, 0);
    opacity: 0;
  }
}
.count {
  position: absolute;
  left: 10%;
  bottom: 6%;
  font-size: max(14px, 21cqi);
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 2px #000;
  letter-spacing: 0.02em;
  animation: bump 0.2s ease-out;
}
@keyframes bump {
  50% {
    transform: scale(1.3);
  }
}
</style>
