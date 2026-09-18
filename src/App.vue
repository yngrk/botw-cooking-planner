<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GoalBar from './components/GoalBar.vue'
import InventoryPanel from './components/InventoryPanel.vue'
import PlanPanel from './components/PlanPanel.vue'
import QuickCount from './components/QuickCount.vue'
import StatusHud from './components/StatusHud.vue'

const editing = ref<string | null>(null)

// Two stops on one surface: the inventory, and below it the cooking section.
// A vertical swipe jumps between them (like the sideways paging, no dragging).
const SWIPE_DISTANCE = 24
const COOK_TOP_SPACE = 48 // px above the cooking section when scrolled there (keep in sync with .cook height)

const cooking = ref(false)
const app = ref<HTMLElement>()
const screens = ref<HTMLElement>()
const cook = ref<HTMLElement>()
const cookView = ref<HTMLElement>()
const cookInner = ref<HTMLElement>()

// Offset that brings the cooking section to the top; also read by the
// inventory's edge fade, which has to stay put on screen.
function place() {
  const y = cooking.value ? cook.value!.offsetTop - parseFloat(getComputedStyle(screens.value!).paddingTop) - COOK_TOP_SPACE : 0
  app.value!.style.setProperty('--screen-y', `${-y}px`)
  // The bottom fade starts where the cooking section peeks in below the grid.
  app.value!.style.setProperty('--teaser-top', `${cook.value!.offsetTop}px`)
}
watch(cooking, place)

// A long plan pages like the rest: a swipe (or "More") moves it by a fixed
// step, so the next card that was cut off lands at the top. No free scrolling.
const INDICATOR_SPACE = 110 // px at the bottom covered by the fade and "More"
const CARD_MARGIN = 12
const cookY = ref(0)
const hasMore = ref(false)

function cards() {
  const top = cookInner.value!.getBoundingClientRect().top
  return [...cookInner.value!.querySelectorAll('.step')].map((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top - top, bottom: r.bottom - top }
  })
}
const maxY = () => Math.max(0, cookInner.value!.offsetHeight - cookView.value!.clientHeight)

function nextPage() {
  const view = cookView.value!.clientHeight - INDICATOR_SPACE
  const cut = cards().find((c) => c.bottom > cookY.value + view)
  let y = cut ? cut.top - CARD_MARGIN : cookY.value + view
  if (y <= cookY.value) y = cookY.value + view // a card taller than the screen
  cookY.value = Math.min(y, maxY())
}

function prevPage() {
  const view = cookView.value!.clientHeight - INDICATOR_SPACE
  const target = cookY.value - view
  // Earliest card that still fits above the current top one.
  const card = cards().find((c) => c.top - CARD_MARGIN >= target && c.top - CARD_MARGIN < cookY.value)
  cookY.value = target <= 0 || !card ? Math.max(0, target) : card.top - CARD_MARGIN
}

function updateMore() {
  if (cookY.value > maxY()) cookY.value = maxY() // plan got shorter
  hasMore.value = cookY.value < maxY() - 1
}
watch(cookY, updateMore)

let startX = 0
let startY = 0
let tracking = false

function onTouchstart(e: TouchEvent) {
  if (e.touches.length !== 1) return (tracking = false)
  tracking = true
  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
}

function swipe(up: boolean) {
  if (!cooking.value) {
    if (up) cooking.value = true
  } else if (up) {
    if (hasMore.value) nextPage()
  } else if (cookY.value > 0) prevPage()
  else cooking.value = false
}

// Touch events, not pointer events: pointer events on the tiles are handled
// (and captured) by the inventory's own sideways paging.
function onTouchmove(e: TouchEvent) {
  if (!tracking) return
  const dy = e.touches[0].clientY - startY
  if (Math.abs(dy) < SWIPE_DISTANCE || Math.abs(dy) < Math.abs(e.touches[0].clientX - startX)) return
  tracking = false
  swipe(dy < 0)
}

// Mouse / trackpad on the Mac.
let wheelLock = 0
function onWheel(e: WheelEvent) {
  if (Math.abs(e.deltaY) < 20 || Math.abs(e.deltaY) < Math.abs(e.deltaX) || e.timeStamp < wheelLock) return
  wheelLock = e.timeStamp + 500
  swipe(e.deltaY > 0)
}

let observer: ResizeObserver | undefined
onMounted(async () => {
  await nextTick()
  observer = new ResizeObserver(() => {
    place()
    updateMore()
  })
  observer.observe(screens.value!)
  observer.observe(cookInner.value!)
  observer.observe(cookView.value!)
  place()
  updateMore()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <main
    ref="app"
    class="app"
    :class="{ cooking }"
    @touchstart.passive="onTouchstart"
    @touchmove.passive="onTouchmove"
    @wheel.passive="onWheel"
  >
    <div ref="screens" class="screens">
      <StatusHud />
      <InventoryPanel class="inventory" @edit="editing = $event" />
      <section ref="cook" class="cook">
        <GoalBar class="goal-bar" />
        <div ref="cookView" class="cook-view">
          <div ref="cookInner" class="cook-inner" :style="{ transform: `translate3d(0, ${-cookY}px, 0)` }">
            <PlanPanel />
          </div>
        </div>
      </section>
    </div>

    <!-- The cooking section fades into the world at the bottom, like the page edges. -->
    <div class="bottom-fade" :class="{ hidden: cooking && !hasMore }" aria-hidden="true" />
    <button
      class="more"
      :class="{ hidden: cooking && !hasMore }"
      :aria-label="cooking ? 'More recipes' : 'Go to cooking'"
      @click="swipe(true)"
    >
      <span>{{ cooking ? 'More' : 'Cook' }}</span>
      <svg viewBox="0 0 56 24" aria-hidden="true"><path d="M28 22 2 2 28 9 54 2Z" /></svg>
    </button>
  </main>
  <QuickCount :id="editing" @close="editing = null" />
</template>

<style scoped>
.app {
  --screen-y: 0px;
  --screen-ease: 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
  height: 100dvh;
  overflow: hidden;
  touch-action: none; /* all vertical movement is swipe-paged in script */
}
/*
 * Slot size: the largest square that fits 5 across (leaving room for the page
 * arrows) with the grid taking at most two thirds of the screen height. The
 * cooking section lines up with the grid.
 */
.screens {
  --gap: 14px;
  --arrow: 40px;
  --grid-max-h: 66dvh;
  --slot: min((100cqw - 4 * var(--gap) - 2 * var(--arrow) - 72px) / 5, (var(--grid-max-h) - 3 * var(--gap)) / 4);
  --grid-w: calc(5 * var(--slot) + 4 * var(--gap));
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 56px;
  padding: calc(var(--safe-top) + 16px) calc(var(--safe-right) + 20px) calc(var(--safe-bottom) + 16px)
    calc(var(--safe-left) + 20px);
  transform: translate3d(0, var(--screen-y), 0);
  transition: transform var(--screen-ease);
  will-change: transform;
}
.inventory {
  flex: none;
}
.screens > :not(.cook) {
  transition: opacity 0.3s;
}
/* Scrolled down to cooking: the inventory's last row would peek in cut off at the top. */
.cooking .screens > :not(.cook) {
  opacity: 0;
}
.goal-bar {
  margin-bottom: 20px;
}
.cook {
  flex: none;
  height: calc(100dvh - var(--safe-top) - var(--safe-bottom) - 32px - 48px); /* 48px = COOK_TOP_SPACE */
  width: var(--grid-w);
  align-self: center;
  margin-top: -32px; /* closer than the HUD gap, so it peeks in below the grid */
  display: flex;
  flex-direction: column;
}
.cook-view {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.cook-inner {
  transition: transform var(--screen-ease);
  will-change: transform;
}

/* Static copy of the page background (body::before), shown only at the bottom. */
.bottom-fade {
  position: absolute;
  inset: -24px;
  pointer-events: none;
  background: url('/bg/menu.jpg') center / cover no-repeat, var(--bg);
  filter: blur(8px) brightness(0.42) saturate(0.85);
  transform: translateZ(0);
  --fade: linear-gradient(
    to bottom,
    transparent calc(24px + var(--teaser-top, 70dvh)),
    #000 calc(100% - 24px - var(--safe-bottom) - 16px)
  );
  -webkit-mask-image: var(--fade);
  mask-image: var(--fade);
  transition: opacity 0.3s;
}
.more {
  position: absolute;
  left: 50%;
  bottom: calc(var(--safe-bottom) + 12px);
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 120px;
  padding: 6px 12px;
  border: none;
  background: none;
  color: #f2f0e8;
  font-size: 20px; /* outside .screens, so no --slot here */
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  transition: opacity 0.3s;
}
.more svg {
  width: 40px;
  height: 17px;
  fill: #f2f0e8;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}
/* On the cooking page the fade only covers the bottom, above "More". */
.cooking .bottom-fade {
  --fade: linear-gradient(
    to bottom,
    transparent calc(100% - 24px - var(--safe-bottom) - 150px),
    #000 calc(100% - 24px - var(--safe-bottom) - 16px)
  );
}
/* Nothing more below: the indicator has done its job. */
.bottom-fade.hidden,
.more.hidden {
  opacity: 0;
  pointer-events: none;
}
</style>
