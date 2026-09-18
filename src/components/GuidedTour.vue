<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// First-visit tour: a spotlight on one part of the screen at a time, with a
// short in-game style text box beside it. The App switches to the cooking
// section for the steps that live there.
const emit = defineEmits<{ screen: [cooking: boolean]; done: [] }>()

interface Step {
  target?: string // selector; none = centred box without spotlight
  cooking: boolean
  title: string
  text: string
}

const STEPS: Step[] = [
  {
    cooking: false,
    title: 'Welcome!',
    text: 'This planner shows the best dishes you can cook from what you carry. Here’s a quick look around.',
  },
  {
    target: '.status',
    cooking: false,
    title: 'Hearts & stamina',
    text: 'Set them to match your game: tap to add a heart or a fifth of a wheel, long press to reset.',
  },
  {
    target: '.inventory .grid',
    cooking: false,
    title: 'Your ingredients',
    text: 'Tap an ingredient once for every piece you have. Long press to type an exact number. Swipe sideways for more.',
  },
  {
    target: '.more',
    cooking: false,
    title: 'Cook',
    text: 'Swipe up or tap here to see what you can cook.',
  },
  {
    target: '.goals',
    cooking: true,
    title: 'What to cook for',
    text: 'Pick the effect you want. Below, the best dishes from your ingredients show up, best first.',
  },
  {
    target: '.plan .step',
    cooking: true,
    title: 'Recipes',
    text: 'When you’ve cooked a dish in the game, tap “Cooked” and its ingredients come off your list.',
  },
]

const PAD = 8 // spotlight margin around the target
const MARGIN = 16 // text box distance from the screen edges and the spotlight

const index = ref(0)
const step = computed(() => STEPS[index.value])
const last = computed(() => index.value === STEPS.length - 1)

const hole = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const boxPos = ref({ left: 0, top: 0 })
const box = ref<HTMLElement>()
const next = ref<HTMLButtonElement>()

// Follow the target every frame: it moves while the screen slides to the
// cooking section, and on rotation or resize.
let frame = 0
function track() {
  const el = step.value.target ? document.querySelector(step.value.target) : null
  const r = el?.getBoundingClientRect()
  hole.value = r ? { x: r.left - PAD, y: r.top - PAD, w: r.width + 2 * PAD, h: r.height + 2 * PAD } : null
  place()
  frame = requestAnimationFrame(track)
}

// Below the spotlight if it fits, else above, else over it at the bottom.
function place() {
  const b = box.value
  if (!b) return
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = b.offsetWidth
  const h = b.offsetHeight
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), vw - w - MARGIN)
  const t = hole.value
  if (!t) {
    boxPos.value = { left: clampX((vw - w) / 2), top: (vh - h) / 2 }
    return
  }
  const left = clampX(t.x + t.w / 2 - w / 2)
  const below = t.y + t.h + MARGIN
  const above = t.y - MARGIN - h
  const top = below + h <= vh - MARGIN ? below : above >= MARGIN ? above : vh - h - MARGIN
  boxPos.value = { left, top }
}

function go(i: number) {
  index.value = i
  emit('screen', step.value.cooking)
  nextTick(() => next.value?.focus())
}

function finish() {
  emit('screen', false)
  emit('done')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') finish()
}

watch(index, () => nextTick(place))
onMounted(() => {
  go(0)
  frame = requestAnimationFrame(track)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <!-- Swallows every touch, so the app underneath doesn't page or scroll during the tour. -->
  <div class="tour" role="dialog" aria-modal="true" :aria-label="`Tour, step ${index + 1} of ${STEPS.length}`">
    <div
      class="hole"
      :class="{ none: !hole }"
      :style="hole ? { left: `${hole.x}px`, top: `${hole.y}px`, width: `${hole.w}px`, height: `${hole.h}px` } : undefined"
    />
    <div ref="box" class="box" :style="{ left: `${boxPos.left}px`, top: `${boxPos.top}px` }">
      <!-- New element per step, so the text fades in fresh. -->
      <div :key="index" class="text" aria-live="polite">
        <h2>{{ step.title }}</h2>
        <p>{{ step.text }}</p>
      </div>
      <div class="actions">
        <span class="count">{{ index + 1 }} / {{ STEPS.length }}</span>
        <button v-if="!last" class="skip" @click="finish">Skip</button>
        <button v-if="index > 0" class="back" @click="go(index - 1)">Back</button>
        <button ref="next" class="next" @click="last ? finish() : go(index + 1)">
          {{ last ? 'Let’s go' : 'Next' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tour {
  position: fixed;
  inset: 0;
  z-index: 50;
  touch-action: none;
  animation: tour-in 0.3s ease-out;
}
@keyframes tour-in {
  from {
    opacity: 0;
  }
}
/* Everything but the target is dimmed by the spotlight's huge shadow. */
.hole {
  position: absolute;
  border-radius: 8px;
  box-shadow:
    0 0 0 200vmax rgba(0, 0, 0, 0.62),
    0 0 16px rgba(255, 255, 255, 0.35);
  outline: var(--frame-width) solid var(--frame-line-on);
  pointer-events: none;
}
/* Welcome step: no target, just dim the whole screen. */
.hole.none {
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  outline: none;
  box-shadow: 0 0 0 200vmax rgba(0, 0, 0, 0.62);
}
.box {
  position: absolute;
  width: min(360px, 100vw - 32px);
  padding: 16px 18px 14px;
  border-radius: var(--frame-radius);
  background: rgba(12, 12, 12, 0.9);
  outline: var(--frame-width) solid var(--frame-line-strong);
  outline-offset: var(--frame-inset);
  color: #f2f0e8;
  transition:
    left 0.3s var(--spring),
    top 0.3s var(--spring);
}
h2 {
  margin: 0 0 6px;
  font-size: 19px;
  font-weight: 700;
  color: #fff;
}
p {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.8);
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}
.count {
  margin-right: auto;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}
button {
  min-height: 40px;
  padding: 0 14px;
  border: none;
  border-radius: var(--frame-radius);
  background: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 15px;
  font-weight: 700;
}
/* Same framed button as "Cooked". */
.next {
  color: #fff;
  background: var(--frame-bg);
  outline: var(--frame-width) solid var(--frame-line-strong);
  outline-offset: calc(var(--frame-inset) + 2px);
}
.next:active {
  outline-color: var(--frame-line-on);
  box-shadow: var(--frame-glow);
}
.text {
  animation: tour-in 0.25s ease-out;
}
</style>
