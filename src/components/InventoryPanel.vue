<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { INGREDIENTS } from '../data'
import IngredientTile from './IngredientTile.vue'

defineEmits<{ edit: [id: string] }>()

// Like the in-game Materials tab: pages of 5 × 4 slots, filled row by row, swiped sideways.
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
onBeforeUnmount(() => observer?.disconnect())
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
            <IngredientTile v-for="i in page" :key="i.id" :item="i" @longpress="$emit('edit', $event)" />
          </div>
        </div>
      </div>
    </div>
    <div ref="fade" class="edge-fade" aria-hidden="true" />
    <!-- In-game page arrows: only shown when there is a page in that direction. -->
    <Transition name="arrow">
      <button v-if="current > 0" class="arrow prev" aria-label="Previous page" @click="goTo(current - 1)">
        <svg viewBox="0 0 24 56" aria-hidden="true"><path d="M2 28 22 2 15 28 22 54Z" /></svg>
      </button>
    </Transition>
    <Transition name="arrow">
      <button
        v-if="current < pages.length - 1"
        class="arrow next"
        aria-label="Next page"
        @click="goTo(current + 1)"
      >
        <svg viewBox="0 0 24 56" aria-hidden="true"><path d="M2 28 22 2 15 28 22 54Z" /></svg>
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
  height: calc(4 * var(--slot) + 3 * var(--gap));
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
  grid-template-columns: repeat(5, var(--slot));
  grid-auto-rows: var(--slot);
  gap: var(--gap);
  align-content: start;
  height: calc(4 * var(--slot) + 3 * var(--gap));
}
.arrow {
  position: absolute;
  top: 50%;
  width: var(--arrow);
  height: 88px;
  margin-top: -44px;
  padding: 0;
  border: none;
  background: none;
  display: grid;
  place-items: center;
  transition: transform 0.28s var(--spring);
}
.arrow svg {
  width: 24px;
  height: 56px;
  fill: #f2f0e8;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}
.prev {
  left: calc(50% - var(--grid-w) / 2 - var(--arrow) - 8px);
}
.next {
  right: calc(50% - var(--grid-w) / 2 - var(--arrow) - 8px);
}
.next svg {
  transform: scaleX(-1);
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
