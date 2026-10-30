<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useGameStore, type MotionPreference, type Quality } from '@/stores/game'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useGameStore()
const panel = ref<HTMLElement | null>(null)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    panel.value?.focus()
  },
)

const qualityOptions: Array<{ value: Quality; label: string; hint: string }> = [
  { value: 'auto', label: '自动', hint: '先高画质，掉帧时自动降档' },
  { value: 'high', label: '高', hint: 'DPR 2 + 2048 阴影 + 粒子' },
  { value: 'medium', label: '中', hint: 'DPR 1.75 + 1024 阴影' },
  { value: 'low', label: '低', hint: 'DPR 1.25，关闭阴影与粒子' },
]

const motionOptions: Array<{ value: MotionPreference; label: string }> = [
  { value: 'auto', label: '跟随系统' },
  { value: 'reduced', label: '减少' },
]

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
  <Teleport to="body">
    <div v-if="open" class="settings-backdrop" @click.self="emit('close')">
      <section
        ref="panel"
        class="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabindex="-1"
        @keydown.esc="emit('close')"
      >
        <header>
          <div>
            <p class="eyebrow">PREFERENCES</p>
            <h2 id="settings-title">设置</h2>
          </div>
          <button type="button" class="close" aria-label="关闭设置" @click="emit('close')">
            ×
          </button>
        </header>

        <div class="setting-row">
          <div class="setting-label">
            <span>音效</span>
            <small>点击、消除与胜利提示音</small>
          </div>
          <button
            type="button"
            class="switch"
            :class="{ on: store.sound }"
            :aria-pressed="store.sound"
            @click="store.setSound(!store.sound)"
          >
            {{ store.sound ? '开' : '关' }}
          </button>
        </div>

        <div class="setting-block">
          <div class="setting-label">
            <span>画质</span>
            <small>影响 DPR、阴影与粒子数量</small>
          </div>
          <div class="segmented" role="group" aria-label="画质">
            <button
              v-for="option in qualityOptions"
              :key="option.value"
              type="button"
              :class="{ active: store.quality === option.value }"
              :aria-pressed="store.quality === option.value"
              :title="option.hint"
              @click="store.setQuality(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <p class="hint">
            {{ qualityOptions.find((option) => option.value === store.quality)?.hint }}
          </p>
        </div>

        <div class="setting-block">
          <div class="setting-label">
            <span>动效</span>
            <small>减少粒子、脉冲与过渡</small>
          </div>
          <div class="segmented" role="group" aria-label="动效">
            <button
              v-for="option in motionOptions"
              :key="option.value"
              type="button"
              :class="{ active: store.motion === option.value }"
              :aria-pressed="store.motion === option.value"
              @click="store.setMotion(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="setting-block appearance-block">
          <div class="setting-label">
            <span>光照与牌面材质</span>
            <small>实时生效；默认值已调柔和，可继续微调</small>
          </div>

          <div class="slider-field">
            <div class="slider-head">
              <label for="light-intensity">光照强度</label>
              <output>{{ store.lightIntensity.toFixed(2) }}</output>
            </div>
            <input
              id="light-intensity"
              type="range"
              min="0.35"
              max="1.8"
              step="0.01"
              :value="store.lightIntensity"
              aria-label="光照强度"
              @input="onLightIntensity"
            />
          </div>

          <div class="slider-field">
            <div class="slider-head">
              <label for="light-temperature">色温</label>
              <output>{{ Math.round(store.lightTemperature) }} K</output>
            </div>
            <input
              id="light-temperature"
              type="range"
              min="2700"
              max="6500"
              step="50"
              :value="store.lightTemperature"
              aria-label="色温"
              @input="onLightTemperature"
            />
          </div>

          <div class="slider-field">
            <div class="slider-head">
              <label for="tile-roughness">牌面粗糙度</label>
              <output>{{ store.tileRoughness.toFixed(2) }}</output>
            </div>
            <input
              id="tile-roughness"
              type="range"
              min="0.18"
              max="0.95"
              step="0.01"
              :value="store.tileRoughness"
              aria-label="牌面粗糙度"
              @input="onTileRoughness"
            />
          </div>

          <div class="slider-field">
            <div class="slider-head">
              <label for="tile-reflectivity">反光强度</label>
              <output>{{ store.tileReflectivity.toFixed(2) }}</output>
            </div>
            <input
              id="tile-reflectivity"
              type="range"
              min="0"
              max="1.2"
              step="0.01"
              :value="store.tileReflectivity"
              aria-label="反光强度"
              @input="onTileReflectivity"
            />
          </div>

          <button type="button" class="reset-appearance" @click="store.resetAppearance()">
            恢复默认光照
          </button>
        </div>

        <button type="button" class="btn btn-primary done" @click="emit('close')">
          完成
        </button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 8, 6, 0.62);
  backdrop-filter: blur(8px);
}

.settings-panel {
  width: min(460px, 100%);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  padding: clamp(22px, 4vw, 32px);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(380px 200px at 50% 0%, rgba(217, 179, 108, 0.08), transparent 70%),
    rgba(8, 22, 18, 0.96);
  box-shadow: var(--shadow-panel), inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--gold);
  font-size: 10px;
  letter-spacing: 0.3em;
}

h2 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 0.16em;
}

.close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.close:hover {
  color: var(--ivory);
  border-color: var(--line);
}

.setting-row,
.setting-block {
  padding: 15px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label span {
  font-size: 13px;
  letter-spacing: 0.06em;
}

.setting-label small,
.hint {
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.6;
}

.switch {
  min-width: 56px;
  height: 32px;
  padding: 0 13px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.25);
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.switch.on {
  border-color: rgba(217, 179, 108, 0.55);
  background: rgba(217, 179, 108, 0.16);
  color: var(--gold);
}

.segmented {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 5px;
  margin-top: 12px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 11px;
  background: rgba(0, 0, 0, 0.18);
}

.segmented button {
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.segmented button:hover {
  color: var(--ivory);
}

.segmented button.active {
  background: rgba(217, 179, 108, 0.16);
  color: var(--gold);
}

.hint {
  margin: 9px 0 0;
}

.appearance-block {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.slider-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.slider-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.slider-head label {
  color: var(--ivory);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.slider-head output {
  min-width: 58px;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  text-align: right;
}

.slider-field input[type='range'] {
  width: 100%;
  height: 20px;
  margin: 0;
  accent-color: var(--gold);
  cursor: pointer;
}

.reset-appearance {
  align-self: flex-start;
  padding: 5px 0;
  border: 0;
  border-bottom: 1px solid rgba(217, 179, 108, 0.35);
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
}

.reset-appearance:hover {
  color: var(--gold);
  border-color: var(--gold);
}

.done {
  width: 100%;
  margin-top: 20px;
}

@media (max-width: 520px) {
  .settings-backdrop {
    padding: 12px;
  }

  .settings-panel {
    padding: 20px 16px;
  }
}
</style>
