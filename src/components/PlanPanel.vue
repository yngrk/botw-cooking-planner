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

const stepKey = (step: PlanStep) => step.dish.entries.map((e) => e.item.id + e.count).join()
</script>

<template>
  <section class="plan">
    <h2 class="section-title title">Recipes · {{ goalLabel }}</h2>
    <div class="opts">
      <button class="chip" :class="{ on: s.includeElixirs }" @click="s.includeElixirs = !s.includeElixirs">
        Elixirs
      </button>
      <button class="chip" :class="{ on: s.allowRare }" @click="s.allowRare = !s.allowRare">
        Allow rare
      </button>
    </div>

    <TransitionGroup name="step" tag="ol" class="steps">
      <li v-for="(step, i) in plan" :key="stepKey(step)" class="step">
        <img class="pic" :src="dishIconUrl(step.dish)" alt="" draggable="false" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'" />
        <div class="head">
          <span class="times">{{ step.times }}×</span>
          <span class="name">{{ step.dish.nameEn }}</span>
          <span v-if="i === 0" class="best">Best</span>
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

    <p v-if="!plan.length" class="hint">
      {{
        hasInventory
          ? `Nothing you have cooks into “${goalLabel}”.`
          : 'Tap the ingredients you have. The recipes show up here right away.'
      }}
    </p>
  </section>
</template>

<style scoped>
/*
 * In-game proportions: text scales with the inventory slot, like the menu's
 * item name (~¼ slot) and description (~⅙ slot). --slot comes from App.vue.
 */
.plan {
  --fs-title: calc(var(--slot) * 0.2);
  --fs-name: calc(var(--slot) * 0.22);
  --fs-text: calc(var(--slot) * 0.16);
  --fs-small: calc(var(--slot) * 0.13);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.title {
  font-size: var(--fs-title);
}
.opts .chip {
  font-size: var(--fs-small);
  min-height: 44px;
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
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  padding: 10px 12px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas: 'pic head head' 'pic ings cook' 'pic stats cook';
  gap: 6px 10px;
}
.step:first-child {
  border-color: rgba(238, 235, 224, 0.6);
}
.pic {
  grid-area: pic;
  align-self: center;
  width: calc(var(--slot) * 0.85);
  height: calc(var(--slot) * 0.85);
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
  width: calc(var(--slot) * 0.42);
  height: calc(var(--slot) * 0.42);
  border: 1px solid rgba(190, 190, 190, 0.45);
  border-radius: 3px;
  background: rgba(14, 14, 14, 0.9);
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
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: var(--fs-text);
  font-weight: 700;
}
.cook:active {
  background: rgba(255, 255, 255, 0.2);
}
.hint {
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
