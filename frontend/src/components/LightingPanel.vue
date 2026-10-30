<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '@/stores/game'

const store = useGameStore()
const collapsed = ref(false)

function inputValue(event: Event): number {
  return Number((event.target as HTMLInputElement).value)
}

function onLightIntensity(event: Event): void {
  store.setLightIntensity(inputValue(event))
}

function onLightTemperature(event: Event): void {
  store.setLightTemperature(inputValue(event))
}

function onTileRoughness(event: Event): void {
  store.setTileRoughness(inputValue(event))
}

function onTileReflectivity(event: Event): void {
  store.setTileReflectivity(inputValue(event))
}
</script>

<template>
  <aside class="lighting-debug" :class="{ collapsed }" aria-label="光照调试面板">
    <header>
      <div class="title">
        <span class="eyebrow">LIGHT DEBUG</span>
        <strong>光照调试</strong>
      </div>
      <button
        type="button"
        class="collapse"
        :aria-label="collapsed ? '展开光照调试' : '收起光照调试'"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        {{ collapsed ? '＋' : '－' }}
      </button>
    </header>

    <div v-if="!collapsed" class="body">
      <label class="slider-field">
        <span class="slider-head">
          <span>光照强度</span>
          <output>{{ store.lightIntensity.toFixed(2) }}</output>
        </span>
        <input
          type="range"
          min="0.35"
          max="1.8"
          step="0.01"
          :value="store.lightIntensity"
          aria-label="光照强度"
          @input="onLightIntensity"
        />
      </label>

      <label class="slider-field">
        <span class="slider-head">
          <span>色温</span>
          <output>{{ Math.round(store.lightTemperature) }} K</output>
        </span>
        <input
          type="range"
          min="2700"
          max="6500"
          step="50"
          :value="store.lightTemperature"
          aria-label="色温"
          @input="onLightTemperature"
        />
      </label>

      <label class="slider-field">
        <span class="slider-head">
          <span>牌面粗糙度</span>
          <output>{{ store.tileRoughness.toFixed(2) }}</output>
        </span>
        <input
          type="range"
          min="0.18"
          max="0.95"
          step="0.01"
          :value="store.tileRoughness"
          aria-label="牌面粗糙度"
          @input="onTileRoughness"
        />
      </label>

      <label class="slider-field">
        <span class="slider-head">
          <span>反光强度</span>
          <output>{{ store.tileReflectivity.toFixed(2) }}</output>
        </span>
        <input
          type="range"
          min="0"
          max="1.2"
          step="0.01"
          :value="store.tileReflectivity"
          aria-label="反光强度"
          @input="onTileReflectivity"
        />
      </label>

      <button type="button" class="reset" @click="store.resetAppearance()">
        恢复默认
      </button>
    </div>
  </aside>
</template>

<style scoped>
.lighting-debug {
  position: fixed;
  top: 92px;
  right: 16px;
  z-index: 26;
  width: 214px;
  padding: 12px 13px 13px;
  border: 1px solid rgba(217, 179, 108, 0.28);
  border-radius: 13px;
  background:
    linear-gradient(160deg, rgba(18, 40, 32, 0.9), rgba(5, 18, 14, 0.94));
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.035);
  backdrop-filter: blur(10px);
  color: var(--ivory);
}

.lighting-debug.collapsed {
  width: 132px;
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.eyebrow {
  color: var(--gold);
  font-size: 8px;
  letter-spacing: 0.22em;
}

.title strong {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.collapse {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.collapse:hover {
  border-color: var(--gold);
  color: var(--gold);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.slider-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  color: var(--muted);
  font-size: 10.5px;
}

.slider-head output {
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  font-size: 10.5px;
}

.slider-field input[type='range'] {
  width: 100%;
  height: 17px;
  margin: 0;
  accent-color: var(--gold);
  cursor: pointer;
}

.reset {
  align-self: flex-start;
  padding: 4px 0;
  border: 0;
  border-bottom: 1px solid rgba(217, 179, 108, 0.3);
  background: transparent;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
}

.reset:hover {
  color: var(--gold);
  border-color: var(--gold);
}

@media (max-width: 720px) {
  .lighting-debug {
    top: auto;
    right: 8px;
    bottom: 88px;
    width: 180px;
    padding: 10px;
  }

  .lighting-debug.collapsed {
    width: 124px;
  }
}
</style>
