<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { INGREDIENTS } from '../data'
import { clearInventory, state } from '../store'
import IngredientTile from './IngredientTile.vue'

// Like the in-game Materials tab: pages of 20 slots (5 × 4, or 4 × 5 on upright phones), filled row by row, swiped sideways.
const PER_PAGE = 20
const pages = Array.from({ length: Math.ceil(INGREDIENTS.length / PER_PAGE) }, (_, p) =>
  INGREDIENTS.slice(p * PER_PAGE, (p + 1) * PER_PAGE),
)
const last = pages.length - 1

// A swipe just flips the page, exactly like tapping an arrow; the track doesn't
// follow the finger. Fires as soon as the swipe is recognised, not on release.
const SWIPE_DISTANCE = 24 // px sideways, and more sideways than vertical

const track = ref<HTMLElement>()
const fade = ref<HTMLElement>()
const current = ref(0)
let pageW = 0 // one grid plus gap; measured, changes on rotation

function setX(animate: boolean) {
  const el = track.value!
  el.classList.toggle('instant', !animate)
  el.style.transform = `translate3d(${-current.value * pageW}px,0,0)`
}
watch(current, () => setX(true))

let pointerId: number | null = null
let startX = 0
let startY = 0
let swiped = false
let swallowClick = false

function onDown(e: PointerEvent) {
  if (pointerId !== null) return
  pointerId = e.pointerId
  startX = e.clientX
  startY = e.clientY
  swiped = false
}

function onMove(e: PointerEvent) {
  if (e.pointerId !== pointerId || swiped) return
  const dx = e.clientX - startX
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(e.clientY - startY)) return
  swiped = true
  // Take the pointer away from the tile so it neither counts +1 nor long-presses.
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  goTo(current.value - Math.sign(dx))
}

function onUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  pointerId = null
  if (swiped) {
    swallowClick = true // the pointerup of a swipe must not also tap a tile
    setTimeout(() => (swallowClick = false))
  }
}

function onClickCapture(e: MouseEvent) {
  if (swallowClick) {
    e.stopPropagation()
    e.preventDefault()
  }
}

function goTo(p: number) {
  current.value = Math.max(0, Math.min(last, p))
}

// Trackpad / mouse wheel on the Mac: one page per sideways gesture.
let wheelLock = 0
function onWheel(e: WheelEvent) {
  // Vertical wheel belongs to the screen (inventory / cooking), see App.vue.
  const d = e.deltaX
  if (Math.abs(d) < 20 || Math.abs(d) < Math.abs(e.deltaY) || e.timeStamp < wheelLock) return
  wheelLock = e.timeStamp + 400
  goTo(current.value + Math.sign(d))
}

// Reset empties the whole inventory, so it takes two taps: the first arms it.
const RESET_ARM_MS = 3000
const hasInventory = computed(() => Object.keys(state.inventory).length > 0)
const resetArmed = ref(false)
let resetTimer: number | undefined
function onReset() {
  clearTimeout(resetTimer)
  if (resetArmed.value) {
    clearInventory()
    resetArmed.value = false
  } else {
    resetArmed.value = true
    resetTimer = window.setTimeout(() => (resetArmed.value = false), RESET_ARM_MS)
  }
}

let observer: ResizeObserver | undefined
onMounted(() => {
  const measure = () => {
    pageW = (track.value!.querySelector('.page') as HTMLElement).offsetWidth
    // The fade copies the page background, so it has to line up with the viewport.
    // Offsets, not getBoundingClientRect: they ignore the screen's vertical slide.
    let top = 0
    let left = 0
    for (let el = fade.value!.parentElement as HTMLElement | null; el; el = el.offsetParent as HTMLElement | null) {
      top += el.offsetTop
      left += el.offsetLeft
    }
    fade.value!.style.top = `${-top - 24}px`
    fade.value!.style.left = `${-left - 24}px`
    setX(false) // rotation: jump, don't animate
  }
  // Decode every icon up front so none has to be decoded mid-swipe.
  for (const img of track.value!.querySelectorAll('img')) img.decode().catch(() => {})
  observer = new ResizeObserver(measure)
  observer.observe(track.value!)
  measure()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(resetTimer)
})
// The left arrow only appears after paging, so its nudge loop would start out of
// phase with the right one. Pin every loop to the page clock so both move in and
// out together.
function syncNudge() {
  document.querySelectorAll('.arrow svg').forEach((svg) => svg.getAnimations().forEach((a) => (a.startTime = 0)))
}
onMounted(syncNudge)
</script>

<template>
  <section class="stage">
    <div
      class="viewport"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @click.capture="onClickCapture"
      @wheel.passive="onWheel"
    >
      <div ref="track" class="track">
        <div v-for="(page, p) in pages" :key="p" class="page">
          <div class="grid">
            <IngredientTile v-for="i in page" :key="i.id" :item="i" />
          </div>
        </div>
      </div>
    </div>
    <div ref="fade" class="edge-fade" aria-hidden="true" />
    <button
      class="reset"
      :class="{ armed: resetArmed }"
      :disabled="!hasInventory"
      :aria-label="resetArmed ? 'Tap again to clear all ingredients' : 'Clear all ingredients'"
      @click="onReset"
    >
      <span class="glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 0 2.1-5M5 4.5v3.8h3.8" /></svg>
      </span>
      <span>{{ resetArmed ? 'Clear all?' : 'Reset' }}</span>
    </button>
    <!-- In-game page arrows: only shown when there is a page in that direction. -->
    <Transition name="arrow" @enter="syncNudge">
      <button v-if="current > 0" class="arrow prev" aria-label="Previous page" @click="goTo(current - 1)">
        <svg viewBox="0 0 24 56" preserveAspectRatio="none" aria-hidden="true"><path d="M2 28 22 2 15 28 22 54Z" /></svg>
      </button>
    </Transition>
    <Transition name="arrow" @enter="syncNudge">
      <button
        v-if="current < pages.length - 1"
        class="arrow next"
        aria-label="Next page"
        @click="goTo(current + 1)"
      >
        <svg viewBox="0 0 24 56" preserveAspectRatio="none" aria-hidden="true"><path d="M2 28 22 2 15 28 22 54Z" /></svg>
      </button>
    </Transition>
  </section>
</template>

<style scoped>
/* Slot and grid size (--slot, --grid-w, …) are defined on .screens in App.vue, shared with the cooking section. */
.stage {
  --edge: calc(50% - var(--grid-w) / 2);
  position: relative;
  container-type: inline-size;
}
.viewport {
  height: var(--grid-h);
  overflow: hidden;
  touch-action: none; /* swipes are handled in script */
}
.track {
  height: 100%;
  display: flex;
  will-change: transform;
  /* Snappy settle: fast start, short soft landing. */
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.track.instant {
  transition: none;
}
/*
 * Neighbouring pages fade into the world at the screen edges. Not a mask on the
 * moving track (Safari re-masks that every frame) but a static copy of the page
 * background (see body::before in style.css), covering the same box, shown only
 * at the sides. Painted once, then just composited over the track.
 */
.edge-fade {
  position: absolute;
  width: calc(100vw + 48px);
  height: calc(100dvh + 48px);
  pointer-events: none;
  background: url('/bg/menu.jpg') center / cover no-repeat, var(--bg);
  filter: blur(8px) brightness(0.42) saturate(0.85);
  /* Stays put on screen while the page slides to the cooking section (App.vue). */
  transform: translate3d(0, calc(-1 * var(--screen-y, 0px)), 0);
  transition: transform var(--screen-ease, 0s);
  --side: calc(50% - var(--grid-w) / 2);
  --fade: linear-gradient(
    90deg,
    #000 calc(var(--side) - var(--slot) * 0.9),
    rgb(0 0 0 / 0.5) calc(var(--side) - var(--gap)),
    transparent calc(var(--side) - 6px),
    transparent calc(100% - var(--side) + 6px),
    rgb(0 0 0 / 0.5) calc(100% - var(--side) + var(--gap)),
    #000 calc(100% - var(--side) + var(--slot) * 0.9)
  );
  -webkit-mask-image: var(--fade);
  mask-image: var(--fade);
}
/* Spacer so page 0 sits centred with the previous-page gap on its left. */
.track::before {
  content: '';
  flex: 0 0 calc(var(--edge) - var(--gap) / 2);
}
.page {
  flex: 0 0 calc(var(--grid-w) + var(--gap));
  display: grid;
  place-items: center;
}
.grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), var(--slot));
  grid-auto-rows: var(--slot);
  gap: var(--gap);
  align-content: start;
  height: var(--grid-h);
}
/*
 * Above the grid's top-right corner. Styled like the game's button prompts
 * ("Ⓨ Sort"): a white round button glyph, then the action in white.
 */
.reset {
  position: absolute;
  bottom: calc(100% + 6px);
  right: calc(50% - var(--grid-w) / 2);
  min-height: 44px;
  padding: 0 2px 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: none;
  color: #f2f0e8;
  font-size: 18px;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  transition: opacity 0.2s;
}
.glyph {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f2f0e8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  transition: transform 0.28s var(--spring);
}
.glyph svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: #1b1b1b;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.reset:active .glyph {
  transform: scale(0.88);
  transition-duration: 0.06s;
}
/* Armed: highlighted like a selected in-game prompt until the second tap. */
.reset.armed {
  color: var(--gold);
}
.reset.armed .glyph {
  background: var(--gold);
  animation: armed 0.9s ease-in-out infinite;
}
@keyframes armed {
  50% {
    box-shadow: 0 0 12px rgba(243, 227, 166, 0.8);
  }
}
.reset:disabled {
  opacity: 0.35;
}
.arrow {
  position: absolute;
  top: 50%;
  width: var(--arrow-w, var(--arrow));
  height: 88px;
  margin-top: -44px;
  padding: 0;
  border: none;
  background: none;
  display: grid;
  place-items: center;
  transition: transform 0.28s var(--spring);
}
/* Slim arrows on phones still get a finger-sized hit area. */
.arrow::before {
  content: '';
  position: absolute;
  inset: 0 -8px;
}
.arrow svg {
  width: min(24px, 100%);
  height: 56px;
  fill: #f2f0e8;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}
.prev {
  left: calc(50% - var(--grid-w) / 2 - var(--arrow-w, var(--arrow)) - var(--arrow-space, 8px));
}
.next {
  right: calc(50% - var(--grid-w) / 2 - var(--arrow-w, var(--arrow)) - var(--arrow-space, 8px));
}
.next svg {
  transform: scaleX(-1);
}
/* Like in-game: the arrows keep nudging outward, towards the page they lead to. */
.prev svg {
  animation: nudge-left 1.1s ease-in-out infinite;
}
.next svg {
  animation: nudge-right 1.1s ease-in-out infinite;
}
@keyframes nudge-left {
  50% {
    translate: calc(-1 * var(--nudge, 6px)) 0;
  }
}
@keyframes nudge-right {
  50% {
    translate: var(--nudge, 6px) 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .arrow svg {
    animation: none;
  }
}
.prev:active {
  transform: translateX(-6px) scale(0.9);
  transition-duration: 0.06s;
}
.next:active {
  transform: translateX(6px) scale(0.9);
  transition-duration: 0.06s;
}
.arrow-enter-active,
.arrow-leave-active {
  transition: opacity 0.2s;
}
.arrow-enter-from,
.arrow-leave-to {
  opacity: 0;
}
</style>
