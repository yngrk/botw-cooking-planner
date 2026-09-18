<script setup lang="ts">
import { computed } from 'vue'
import { BY_ID, categoryInfo } from '../data'
import { iconUrl } from '../icons'
import { addCount, count, state } from '../store'
import { effectInfo } from '../types'
import EffectIcon from './EffectIcon.vue'

defineEmits<{ edit: [id: string] }>()

const item = computed(() => (state.selected ? BY_ID.get(state.selected) : undefined))
const effect = computed(() => effectInfo(item.value?.effect))
const n = computed(() => (item.value ? count(item.value.id) : 0))
</script>

<template>
  <section class="info">
    <template v-if="item">
      <div class="top">
        <img class="big" :src="iconUrl(item)" alt="" draggable="false" />
        <div class="meta">
          <h2 class="name">{{ item.nameEn }}</h2>
          <div class="tags">
            <span class="tag">{{ categoryInfo(item.category).label }}</span>
            <span v-if="effect" class="tag fx"><EffectIcon :kind="effect.key" /> {{ effect.label }}</span>
            <span v-if="item.rare" class="tag">Rare</span>
          </div>
        </div>
      </div>
      <div class="hold">
        <span class="label">In inventory</span>
        <div class="ctrl">
          <button class="round press" aria-label="One less" @click="addCount(item.id, -1)">−</button>
          <button class="value press" aria-label="Enter amount" @click="$emit('edit', item.id)">{{ n }}</button>
          <button class="round press" aria-label="One more" @click="addCount(item.id, 1)">+</button>
        </div>
      </div>
    </template>
    <p v-else class="hint">Tap an ingredient to see it here.</p>
  </section>
</template>

<style scoped>
.info {
  background: rgba(0, 0, 0, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.35);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  padding: 12px 14px;
  min-height: 150px;
}
.top {
  display: flex;
  gap: 12px;
  align-items: center;
}
.big {
  width: 72px;
  height: 72px;
  object-fit: contain;
  flex-shrink: 0;
}
.name {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
}
.tag.fx {
  background: rgba(111, 220, 236, 0.14);
  color: var(--sheikah);
}
.hold {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}
.label {
  color: rgba(255, 255, 255, 0.8);
}
.ctrl {
  display: flex;
  align-items: center;
  gap: 8px;
}
.round {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 22px;
}
.value {
  min-width: 64px;
  height: 44px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.hint {
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}
</style>
