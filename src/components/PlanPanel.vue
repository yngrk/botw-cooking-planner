<script setup lang="ts">
import { computed } from 'vue'
import { effectText, hearts } from '../cook/format'
import { planDishes, type PlanStep } from '../cook/optimizer'
import { dishIconUrl, iconUrl } from '../icons'
import { consume, state } from '../store'
import { GOALS } from '../types'
import EffectIcon from './EffectIcon.vue'

const s = state.settings
const goalLabel = computed(() => GOALS.find((g) => g.key === s.goal)?.label ?? '')
const hasInventory = computed(() => Object.keys(state.inventory).length > 0)

// Recomputes on every inventory tap; the search takes a few ms.
const plan = computed<PlanStep[]>(() => planDishes(state.inventory, { ...s }))

// During the tour, an empty list shows one example recipe instead, so the "Cooked"
// button the tour points at is there to see. The tour overlay blocks every tap on it.
const example = computed<PlanStep[]>(() =>
  !state.tourDone && !plan.value.length ? planDishes({ apple: 5 }, { ...s, goal: 'hearts' }, 1) : [],
)
const steps = computed(() => (plan.value.length ? plan.value : example.value))

const stepKey = (step: PlanStep) => step.dish.entries.map((e) => e.item.id + e.count).join()
</script>

<template>
  <section class="plan">
    <h2 class="section-title title">Recipes · {{ goalLabel }}</h2>
    <div class="opts">
      <button class="toggle" :class="{ on: s.includeElixirs }" :aria-pressed="s.includeElixirs" @click="s.includeElixirs = !s.includeElixirs">
        <span class="box" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg></span>
        Elixirs
      </button>
      <button class="toggle" :class="{ on: s.allowRare }" :aria-pressed="s.allowRare" @click="s.allowRare = !s.allowRare">
        <span class="box" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg></span>
        Allow rare
      </button>
    </div>

    <TransitionGroup name="step" tag="ol" class="steps">
      <li v-for="(step, i) in steps" :key="stepKey(step)" class="step">
        <img class="pic" :src="dishIconUrl(step.dish)" alt="" draggable="false" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'" />
        <div class="head">
          <span class="times">{{ step.times }}×</span>
          <span class="name">{{ step.dish.nameEn }}</span>
          <span v-if="i === 0 && !example.length" class="best">Best</span>
        </div>
        <div class="ings">
          <span v-for="e in step.dish.entries" :key="e.item.id" class="ing" :title="e.item.nameEn">
            <img :src="iconUrl(e.item)" alt="" draggable="false" />
            <b v-if="e.count > 1">x{{ e.count }}</b>
          </span>
        </div>
        <div class="stats">
          <span class="life">
            <EffectIcon kind="hearts" />
            {{ step.dish.effect === 'hearty' ? 'Full recovery' : hearts(step.dish.life) }}
          </span>
          <span v-if="step.dish.effect" class="fx">
            <EffectIcon :kind="step.dish.effect" /> {{ effectText(step.dish) }}
          </span>
          <span class="crit">Crit {{ step.dish.critChance }}%</span>
        </div>
        <button class="cook press" @click="consume(step.dish.entries)">Cooked</button>
      </li>
    </TransitionGroup>

    <!-- Nothing to cook: the game's failed dish, with what to do about it. -->
    <div v-if="!steps.length" class="step empty">
      <img class="pic" :src="dishIconUrl({ nameEn: 'Dubious Food', effect: null })" alt="" draggable="false" />
      <div class="head">
        <span class="name">Dubious Food</span>
      </div>
      <p class="hint">
        {{
          hasInventory
            ? `Nothing you have cooks into “${goalLabel}”.`
            : 'Tap the ingredients you have. The recipes show up here right away.'
        }}
      </p>
    </div>
  </section>
</template>

<style scoped>
/*
 * In-game proportions: text scales with the inventory slot, like the menu's
 * item name (~¼ slot) and description (~⅙ slot). --slot comes from App.vue.
 */
.plan {
  --fs-title: max(17px, var(--slot) * 0.2);
  --fs-name: max(18px, var(--slot) * 0.22);
  --fs-text: max(15px, var(--slot) * 0.16);
  --fs-small: max(13px, var(--slot) * 0.13);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.title {
  font-size: var(--fs-title);
}
/* Toggles look like the slots: dark, slightly transparent, inset border. */
.toggle {
  min-height: 44px;
  padding: 0 16px 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: none;
  border-radius: var(--frame-radius);
  background: var(--frame-bg);
  outline: var(--frame-width) solid var(--frame-line);
  outline-offset: var(--frame-inset);
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--fs-small);
  font-weight: 700;
  transition:
    color 0.15s,
    outline-color 0.15s,
    box-shadow 0.2s;
}
.toggle.on {
  color: #fff;
  outline-color: var(--frame-line-on);
  box-shadow: var(--frame-glow);
}
.box {
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-radius: 2px;
  display: grid;
  place-items: center;
}
.box svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: #fff;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  transition: opacity 0.15s;
}
.toggle.on .box svg {
  opacity: 1;
}
.opts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.steps {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.step {
  background: var(--frame-bg);
  border-radius: var(--frame-radius);
  outline: var(--frame-width) solid var(--frame-line);
  outline-offset: var(--frame-inset);
  padding: 14px 16px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: 'pic head head' 'pic ings cook' 'pic stats cook';
  gap: 6px 10px;
}
.step:first-child {
  outline-color: var(--frame-line-strong);
}
.pic {
  grid-area: pic;
  align-self: center;
  width: max(56px, var(--slot) * 0.85);
  height: max(56px, var(--slot) * 0.85);
  object-fit: contain;
}
.head {
  grid-area: head;
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.times {
  font-size: var(--fs-name);
  font-weight: 800;
  color: var(--gold);
}
.name {
  font-size: var(--fs-name);
  font-weight: 700;
  color: #fff;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.best {
  font-size: var(--fs-small);
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  color: #111;
}
.ings {
  grid-area: ings;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ing {
  position: relative;
  width: max(34px, var(--slot) * 0.42);
  height: max(34px, var(--slot) * 0.42);
  border-radius: var(--frame-radius);
  background: var(--frame-bg);
  outline: var(--frame-width) solid var(--frame-line);
  outline-offset: -3px; /* small slot: shallower inset */
}
.ing img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 3px;
}
.ing b {
  position: absolute;
  left: 3px;
  bottom: 0;
  font-size: var(--fs-small);
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 2px #000;
}
.stats {
  grid-area: stats;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: var(--fs-text);
  font-weight: 700;
}
.life {
  color: #ff6b5e;
}
.fx {
  color: var(--sheikah);
}
.crit {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
}
.cook {
  grid-area: cook;
  align-self: center;
  min-height: 48px;
  padding: 0 20px;
  border: none;
  border-radius: var(--frame-radius);
  background: var(--frame-bg);
  outline: var(--frame-width) solid var(--frame-line-strong);
  outline-offset: var(--frame-inset);
  color: #fff;
  font-size: var(--fs-text);
  font-weight: 700;
}
.cook:active {
  outline-color: var(--frame-line-on);
  box-shadow: var(--frame-glow);
}
.empty {
  grid-template-columns: auto 1fr;
  grid-template-areas: 'pic head' 'pic hint';
  align-content: center;
}
.hint {
  grid-area: hint;
  align-self: start;
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--fs-text);
  margin: 0;
}

.step-enter-active,
.step-leave-active {
  transition:
    opacity 0.2s,
    transform 0.3s var(--spring);
}
.step-enter-from,
.step-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
.step-move {
  transition: transform 0.3s var(--spring);
}
.step-leave-active {
  position: absolute;
  width: 100%;
}
</style>
