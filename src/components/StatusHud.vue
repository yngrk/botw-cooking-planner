<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { usePress } from '../press'
import { DEFAULT_HEARTS, DEFAULT_STAMINA, MAX_HEARTS, MAX_STAMINA, state } from '../store'

// Heart containers and stamina, like the in-game HUD. Tap adds one, hold resets.
const s = state.settings

// Like in-game, whatever was just added flashes once. The key change remounts the
// element so the flash replays on every tap; a reset clears it without flashing.
const flashHeart = ref(0) // 1-based heart number, 0 = none
const flashWheel = ref(-1)
const heartFlashes = ref(0)
const wheelFlashes = ref(0)

// A tap shows how to undo it: a small hint, gone after a moment (or right away
// once the user does hold to reset). It sits beside the stamina row for both,
// since the hearts row can be nearly as wide as a phone screen.
const TIP_MS = 2500
const tip = ref(false)
let tipTimer: number | undefined
function showTip() {
  tip.value = true
  clearTimeout(tipTimer)
  tipTimer = window.setTimeout(() => (tip.value = false), TIP_MS)
}
function hideTip() {
  clearTimeout(tipTimer)
  tip.value = false
}
onBeforeUnmount(() => clearTimeout(tipTimer))

const heartPress = usePress(
  () => {
    showTip()
    if (s.maxHearts >= MAX_HEARTS) return
    s.maxHearts++
    flashHeart.value = s.maxHearts
    heartFlashes.value++
  },
  () => {
    hideTip()
    s.maxHearts = DEFAULT_HEARTS
    flashHeart.value = 0
  },
)
const staminaPress = usePress(
  () => {
    showTip()
    if (s.maxStamina >= MAX_STAMINA) return
    s.maxStamina++
    flashWheel.value = Math.ceil(s.maxStamina / 5) - 1
    wheelFlashes.value++
  },
  () => {
    hideTip()
    s.maxStamina = DEFAULT_STAMINA
    flashWheel.value = -1
  },
)

const FIFTH = 1 / 5

// One wheel per started five fifths, side by side; the last one may be partly filled.
const wheels = computed(() =>
  Array.from({ length: Math.ceil(s.maxStamina / 5) }, (_, i) => Math.min(5, s.maxStamina - i * 5) / 5),
)
const wheelsLabel = computed(() => {
  const whole = Math.floor(s.maxStamina / 5)
  const fifths = s.maxStamina % 5
  return `${whole}${fifths ? ` ${fifths}/5` : ''} stamina wheels`
})
</script>

<template>
  <header class="hud">
    <div class="row">
      <button
        class="hearts"
        :aria-label="`${s.maxHearts} hearts. Tap: one more, hold: reset`"
        v-on="heartPress"
      >
        <svg
          v-for="h in s.maxHearts"
          :key="h === flashHeart ? `${h}-${heartFlashes}` : h"
          class="heart"
          :class="{ flash: h === flashHeart }"
          viewBox="0 0 24 22"
          aria-hidden="true"
        >
          <path d="M12 21.2 2.6 12.1A5.9 5.9 0 0 1 12 4.6a5.9 5.9 0 0 1 9.4 7.5Z" />
        </svg>
      </button>
    </div>

    <div class="row">
      <button class="stamina" :aria-label="`${wheelsLabel}. Tap: one fifth more, hold: reset`" v-on="staminaPress">
        <svg
          v-for="(fill, i) in wheels"
          :key="i"
          class="wheel"
          viewBox="0 0 40 40"
          aria-hidden="true"
        >
          <circle class="track" cx="20" cy="20" r="15" />
          <!-- The fifth just added is drawn on its own so it can fade in white, then turn green. -->
          <circle
            class="fill"
            cx="20"
            cy="20"
            r="15"
            pathLength="1"
            :stroke-dasharray="`${i === flashWheel ? fill - FIFTH : fill} 1`"
          />
          <circle
            v-if="i === flashWheel"
            :key="wheelFlashes"
            class="fill added"
            cx="20"
            cy="20"
            r="15"
            pathLength="1"
            :style="{ '--start': fill - FIFTH }"
          />
        </svg>
      </button>
      <Transition name="tip">
        <p v-if="tip" class="tip" role="status">Long press to reset</p>
      </Transition>
    </div>
  </header>
</template>

<style scoped>
.hud {
  position: relative;
  z-index: 1; /* above the inventory's edge fade */
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
button {
  padding: 4px 6px;
  border: none;
  background: none;
  border-radius: 10px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
/* Small in-game style box beside the row that was tapped. */
.tip {
  margin: 0;
  padding: 7px 12px;
  border-radius: var(--frame-radius);
  background: var(--frame-bg);
  outline: var(--frame-width) solid var(--frame-line);
  outline-offset: var(--frame-inset);
  color: #f2f0e8;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
}
.tip-enter-active,
.tip-leave-active {
  transition:
    opacity 0.25s,
    translate 0.25s ease-out;
}
.tip-enter-from,
.tip-leave-to {
  opacity: 0;
  translate: -6px 0;
}
.hearts {
  display: grid;
  grid-template-columns: repeat(10, 26px);
  gap: 3px 2px;
  min-height: 44px;
  align-content: center;
  justify-items: center;
}
.heart {
  width: 24px;
  height: 22px;
  fill: #ec2d2d;
}
.stamina {
  display: flex;
  gap: 4px;
  min-height: 44px;
  align-items: center;
}
.wheel {
  width: 40px;
  height: 40px;
  display: block;
  /* Arcs start at 12 o'clock and fill clockwise, like the game. */
  transform: rotate(-90deg);
}
.track {
  fill: none;
  stroke: rgba(0, 0, 0, 0.45);
  stroke-width: 8;
}
.fill {
  fill: none;
  stroke-width: 8;
  stroke: #3ee26b;
  filter: drop-shadow(0 0 3px rgba(62, 226, 107, 0.55));
}

/* In-game: the new heart fades in white, then the white turns red. */
.heart.flash {
  animation: heart-in 0.7s ease-out;
}
@keyframes heart-in {
  0% {
    opacity: 0;
    fill: #fff;
  }
  35% {
    opacity: 1;
    fill: #fff;
  }
  100% {
    fill: #ec2d2d;
  }
}
/* Same for the stamina fifth just added. */
.added {
  --seg: 0.2;
  stroke-dasharray: 0 var(--start) var(--seg) 1;
  animation: fifth-in 0.8s;
}
/* Grows clockwise in white, then turns green. */
@keyframes fifth-in {
  0% {
    stroke-dasharray: 0 var(--start) 0 1;
    stroke: #fff;
    animation-timing-function: ease-out;
  }
  40% {
    stroke-dasharray: 0 var(--start) var(--seg) 1;
    stroke: #fff;
    animation-timing-function: ease-in-out;
  }
  100% {
    stroke-dasharray: 0 var(--start) var(--seg) 1;
    stroke: #3ee26b;
  }
}
</style>
