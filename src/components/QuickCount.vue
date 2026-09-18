<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BY_ID } from '../data'
import { iconUrl } from '../icons'
import { MAX_COUNT, count, setCount } from '../store'

const props = defineProps<{ id: string | null }>()
const emit = defineEmits<{ close: [] }>()

const item = computed(() => (props.id ? BY_ID.get(props.id) : undefined))
const value = ref(0)
// First digit typed replaces the current value, following digits append.
const fresh = ref(true)

watch(
  () => props.id,
  (id) => {
    if (id) {
      value.value = count(id)
      fresh.value = true
    }
  },
  { immediate: true },
)

function set(v: number) {
  value.value = Math.max(0, Math.min(MAX_COUNT, v))
  fresh.value = true
}

function digit(d: number) {
  const next = fresh.value ? d : value.value * 10 + d
  value.value = Math.min(MAX_COUNT, next)
  fresh.value = false
}

function backspace() {
  value.value = Math.floor(value.value / 10)
  fresh.value = false
}

function done() {
  if (props.id) setCount(props.id, value.value)
  emit('close')
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="item" class="backdrop" @click.self="done">
      <div class="sheet" role="dialog" :aria-label="`Amount of ${item.nameEn}`">
        <div class="head">
          <img class="icon" :src="iconUrl(item)" alt="" draggable="false" />
          <span class="title">{{ item.nameEn }}</span>
          <span class="value" :class="{ fresh }">{{ value }}</span>
        </div>
        <div class="steps">
          <button @click="set(value - 10)">−10</button>
          <button @click="set(value - 1)">−1</button>
          <button @click="set(value + 1)">+1</button>
          <button @click="set(value + 10)">+10</button>
        </div>
        <div class="pad">
          <button v-for="d in [1, 2, 3, 4, 5, 6, 7, 8, 9]" :key="d" @click="digit(d)">{{ d }}</button>
          <button class="muted" @click="set(0)">Set to 0</button>
          <button @click="digit(0)">0</button>
          <button class="muted" aria-label="Delete last digit" @click="backspace">⌫</button>
        </div>
        <button class="primary" @click="done">Done</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.sheet {
  width: min(380px, 100%);
  background: rgba(10, 16, 16, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.icon {
  width: 52px;
  height: 52px;
  object-fit: contain;
}
.title {
  flex: 1;
  font-weight: 700;
  font-size: 20px;
  color: #fff;
}
.value {
  font-size: 34px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 2.5ch;
  text-align: right;
}
.value.fresh {
  color: var(--gold);
}
.steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
button {
  height: 56px;
  font-size: 22px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  transition: transform 0.28s var(--spring), background-color 0.15s;
  color: var(--text);
}
button:active {
  transform: scale(0.93);
  background: rgba(255, 255, 255, 0.16);
  transition-duration: 0.06s;
}
.steps button {
  font-size: 18px;
}
.muted {
  font-size: 15px;
  color: var(--text-2);
}
.primary {
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  font-weight: 600;
  font-size: 18px;
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.15s;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
</style>
