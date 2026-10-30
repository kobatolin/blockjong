<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import {
  DEFAULT_RENDER_TUNING,
  type RenderTuning,
} from '@/render/GameRenderer'

type NumericTuningKey = {
  [K in keyof RenderTuning]: RenderTuning[K] extends number ? K : never
}[keyof RenderTuning]

interface ParamDef {
  key: NumericTuningKey
  label: string
  min: number
  max: number
  step: number
  digits: number
  unit?: string
}

const emit = defineEmits<{ applyTuning: [RenderTuning] }>()
const tuning = reactive<RenderTuning>({ ...DEFAULT_RENDER_TUNING })
const visible = ref(false)
const collapsed = ref(false)
let colorTimer: ReturnType<typeof setTimeout> | null = null

const colors: Array<{
  key: 'inkColor' | 'redColor' | 'greenColor' | 'faceColor' | 'bodyColor' | 'wallColor'
  label: string
}> = [
  { key: 'faceColor', label: '牌面底色' },
  { key: 'bodyColor', label: '牌体颜色' },
  { key: 'wallColor', label: '墙面反射' },
  { key: 'inkColor', label: '墨色' },
  { key: 'redColor', label: '红色' },
  { key: 'greenColor', label: '绿色' },
]

const groups: Array<{ title: string; note?: string; params: ParamDef[] }> = [
  {
    title: '灯光',
    note: '主光/补光/半球/点光与曝光',
    params: [
      { key: 'exposure', label: '曝光', min: 0.2, max: 1.4, step: 0.005, digits: 3 },
      { key: 'keyIntensity', label: '主光强度', min: 0, max: 4, step: 0.01, digits: 2 },
      { key: 'fillIntensity', label: '补光强度', min: 0, max: 2, step: 0.01, digits: 2 },
      { key: 'hemisphereIntensity', label: '半球光', min: 0, max: 2, step: 0.01, digits: 2 },
      { key: 'pointIntensity', label: '点光强度', min: 0, max: 800, step: 1, digits: 0 },
      { key: 'pointX', label: '点光 X', min: -20, max: 20, step: 0.5, digits: 1 },
      { key: 'pointY', label: '点光 Y', min: 1, max: 30, step: 0.5, digits: 1 },
      { key: 'pointZ', label: '点光 Z', min: -20, max: 20, step: 0.5, digits: 1 },
      { key: 'keyTemperature', label: '主光色温', min: 2700, max: 9000, step: 50, digits: 0, unit: 'K' },
      { key: 'fillTemperature', label: '补光色温', min: 2700, max: 9000, step: 50, digits: 0, unit: 'K' },
      { key: 'hemisphereTemperature', label: '半球色温', min: 2700, max: 9000, step: 50, digits: 0, unit: 'K' },
      { key: 'keyX', label: '主光 X', min: -20, max: 20, step: 0.5, digits: 1 },
      { key: 'keyY', label: '主光 Y', min: 1, max: 30, step: 0.5, digits: 1 },
      { key: 'keyZ', label: '主光 Z', min: -20, max: 20, step: 0.5, digits: 1 },
      { key: 'fillX', label: '补光 X', min: -20, max: 20, step: 0.5, digits: 1 },
      { key: 'fillY', label: '补光 Y', min: 1, max: 30, step: 0.5, digits: 1 },
      { key: 'fillZ', label: '补光 Z', min: -20, max: 20, step: 0.5, digits: 1 },
    ],
  },
  {
    title: '牌体材质',
    note: 'MeshPhysicalMaterial',
    params: [
      { key: 'bodyRoughness', label: '粗糙度', min: 0.02, max: 1, step: 0.01, digits: 2 },
      { key: 'bodyMetalness', label: '金属度', min: 0, max: 1, step: 0.01, digits: 2 },
      { key: 'bodyClearcoat', label: '清漆层', min: 0, max: 1, step: 0.01, digits: 2 },
      { key: 'bodyClearcoatRoughness', label: '清漆粗糙度', min: 0, max: 1, step: 0.01, digits: 2 },
      { key: 'bodyEnvMapIntensity', label: '环境反射', min: 0, max: 2, step: 0.01, digits: 2 },
    ],
  },
  {
    title: '牌面材质',
    note: '阴刻填漆 + 亚克力',
    params: [
      { key: 'faceRoughness', label: '牌面粗糙度', min: 0.05, max: 1, step: 0.01, digits: 2 },
      { key: 'faceClearcoat', label: '牌面清漆', min: 0, max: 1, step: 0.01, digits: 2 },
      { key: 'faceClearcoatRoughness', label: '清漆粗糙度', min: 0, max: 1, step: 0.01, digits: 2 },
      { key: 'faceEnvMapIntensity', label: '牌面反射', min: 0, max: 1, step: 0.005, digits: 3 },
      { key: 'faceBumpScale', label: '阴刻高度', min: 0, max: 0.45, step: 0.001, digits: 3 },
      { key: 'faceInkMetalness', label: '阴刻金属度', min: 0, max: 1, step: 0.01, digits: 2 },
      { key: 'rimOpacity', label: '边缘高光', min: 0, max: 0.8, step: 0.005, digits: 3 },
    ],
  },
]

function format(param: ParamDef): string {
  const value = tuning[param.key]
  return `${value.toFixed(param.digits)}${param.unit ? ` ${param.unit}` : ''}`
}

function clearColorTimer(): void {
  if (colorTimer !== null) {
    clearTimeout(colorTimer)
    colorTimer = null
  }
}

function applyNow(): void {
  clearColorTimer()
  emit('applyTuning', { ...tuning })
}

function onInput(key: NumericTuningKey, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  tuning[key] = value
  if (key === 'faceBumpScale') {
    // Repainting the 42 height/shadow textures is debounced; the normal scale
    // is applied with the same delayed full tuning payload.
    clearColorTimer()
    colorTimer = setTimeout(() => {
      colorTimer = null
      emit('applyTuning', { ...tuning })
    }, 120)
    return
  }
  applyNow()
}

function onColor(
  key: 'inkColor' | 'redColor' | 'greenColor' | 'faceColor' | 'bodyColor' | 'wallColor',
  event: Event,
): void {
  tuning[key] = (event.target as HTMLInputElement).value
  clearColorTimer()
  // Re-baking 42 face textures is much heavier than moving a material slider.
  colorTimer = setTimeout(() => {
    colorTimer = null
    emit('applyTuning', { ...tuning })
  }, 120)
}

function reset(): void {
  Object.assign(tuning, DEFAULT_RENDER_TUNING)
  applyNow()
}

onBeforeUnmount(clearColorTimer)
</script>

<template>
  <button
    v-if="!visible"
    type="button"
    class="render-launcher"
    aria-label="打开渲染参数"
    @click="visible = true"
  >
    渲染
  </button>

  <aside
    v-if="visible"
    class="lighting-debug"
    :class="{ collapsed }"
    aria-label="渲染参数调试面板"
  >
    <header>
      <div class="title">
        <span class="eyebrow">RENDER DEBUG</span>
        <strong>渲染参数</strong>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="collapse"
          :aria-label="collapsed ? '展开渲染参数' : '收起渲染参数'"
          :aria-expanded="!collapsed"
          @click="collapsed = !collapsed"
        >
          {{ collapsed ? '＋' : '－' }}
        </button>
        <button
          type="button"
          class="collapse"
          aria-label="关闭渲染参数"
          @click="visible = false"
        >
          ×
        </button>
      </div>
    </header>

    <div v-if="!collapsed" class="body">
      <p class="scope">仅调整参数，不改变渲染管线；覆盖基础设置</p>

      <section v-for="group in groups" :key="group.title" class="group">
        <header class="group-head">
          <strong>{{ group.title }}</strong>
          <small v-if="group.note">{{ group.note }}</small>
        </header>
        <label v-for="param in group.params" :key="param.key" class="slider-field">
          <span class="slider-head">
            <span>{{ param.label }}</span>
            <output>{{ format(param) }}</output>
          </span>
          <input
            type="range"
            :min="param.min"
            :max="param.max"
            :step="param.step"
            :value="tuning[param.key]"
            :aria-label="param.label"
            @input="onInput(param.key, $event)"
          />
        </label>
      </section>

      <section class="group">
        <header class="group-head">
          <strong>填漆颜色</strong>
          <small>改色后重烘焙</small>
        </header>
        <label v-for="color in colors" :key="color.key" class="color-field">
          <span>{{ color.label }}</span>
          <span class="color-control">
            <input
              type="color"
              :value="tuning[color.key]"
              :aria-label="color.label"
              @input="onColor(color.key, $event)"
            />
            <output>{{ tuning[color.key] }}</output>
          </span>
        </label>
      </section>

      <button type="button" class="reset" @click="reset">恢复全部默认</button>
    </div>
  </aside>
</template>

<style scoped>
.render-launcher {
  position: fixed;
  top: 50%;
  right: 0;
  z-index: 25;
  padding: 12px 7px;
  border: 1px solid rgba(217, 179, 108, 0.24);
  border-right: 0;
  border-radius: 10px 0 0 10px;
  background: rgba(7, 18, 15, 0.72);
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.2em;
  writing-mode: vertical-rl;
  cursor: pointer;
  transform: translateY(-50%);
  backdrop-filter: blur(8px);
}

.render-launcher:hover {
  border-color: rgba(217, 179, 108, 0.55);
  color: var(--ivory);
}

.lighting-debug {
  position: fixed;
  top: 92px;
  right: 16px;
  z-index: 26;
  width: 238px;
  max-height: calc(100vh - 120px);
  padding: 12px 13px 14px;
  overflow-y: auto;
  border: 1px solid rgba(217, 179, 108, 0.28);
  border-radius: 13px;
  background:
    linear-gradient(160deg, rgba(18, 40, 32, 0.92), rgba(5, 18, 14, 0.96));
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.035);
  backdrop-filter: blur(10px);
  color: var(--ivory);
  scrollbar-width: thin;
}

.lighting-debug.collapsed {
  width: 146px;
  overflow: hidden;
}

header {
  position: sticky;
  top: -12px;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0 8px;
  background: rgba(8, 22, 17, 0.94);
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

.header-actions {
  display: flex;
  gap: 6px;
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
  margin-top: 2px;
}

.scope {
  margin: 0;
  color: var(--muted);
  font-size: 9.5px;
  line-height: 1.5;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 9px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.group-head strong {
  color: var(--gold);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.group-head small {
  color: var(--muted);
  font-size: 8.5px;
  white-space: nowrap;
}

.slider-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.slider-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  color: var(--muted);
  font-size: 10px;
}

.slider-head output {
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  font-size: 9.5px;
}

.slider-field input[type='range'] {
  width: 100%;
  height: 15px;
  margin: 0;
  accent-color: var(--gold);
  cursor: pointer;
}

.color-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--muted);
  font-size: 10px;
}

.color-control {
  display: flex;
  align-items: center;
  gap: 7px;
}

.color-control input[type='color'] {
  width: 34px;
  height: 22px;
  padding: 1px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.color-control output {
  min-width: 54px;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  font-size: 9px;
  text-align: right;
}

.reset {
  align-self: flex-start;
  margin-top: 3px;
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
    top: 88px;
    right: 8px;
    width: 190px;
    max-height: calc(100vh - 180px);
    padding: 10px;
  }

  .lighting-debug.collapsed {
    width: 126px;
  }
}
</style>
