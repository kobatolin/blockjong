<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  MODE_CONFIGS,
  MODE_IDS,
  layoutDimensions,
  totalTilesForMode,
} from '@/core/kinds'
import {
  formatSeed,
  formatSeedHex,
  parseSeedInput,
  randomSeed,
} from '@/core/seed'
import type { Layout, ModeId, SeedSource } from '@/core/types'
import { useGameStore } from '@/stores/game'
import { formatTime } from '@/utils/format'
import { writeUrlState } from '@/utils/url'
import SeedInput from './SeedInput.vue'
import SettingsPanel from './SettingsPanel.vue'

interface StartOptions {
  mode: ModeId
  seed: number
  seedSource: SeedSource
  layout: Layout
}

const props = defineProps<{
  initialMode?: ModeId
  initialSeed?: number | null
  initialLayout?: Layout
}>()

const emit = defineEmits<{
  start: [options: StartOptions]
}>()

const store = useGameStore()
const settingsOpen = ref(false)
const selectedMode = ref<ModeId>(props.initialMode ?? 'easy')
const layout = ref<Layout>(
  props.initialLayout ??
    (typeof window !== 'undefined' && window.innerWidth > window.innerHeight
      ? 'wide'
      : 'tall'),
)
const seedOpen = ref(
  props.initialSeed !== null && props.initialSeed !== undefined,
)
const seedText = ref(
  props.initialSeed !== null && props.initialSeed !== undefined
    ? formatSeedHex(props.initialSeed)
    : '',
)

const parsed = computed(() => parseSeedInput(seedText.value))
const seedError = computed(() => (parsed.value.ok ? '' : parsed.value.error))
const canStart = computed(() => parsed.value.ok)

const seedPreview = computed(() => {
  if (!parsed.value.ok) return parsed.value.error
  if (parsed.value.seed === null) return '留空：开局时生成随机种子，并计入最佳记录'
  return `将使用 ${formatSeed(parsed.value.seed)}（自定义种子，不计入最佳记录）`
})

const modeCards = computed(() =>
  MODE_IDS.map((id) => {
    const config = MODE_CONFIGS[id]
    const dims = layoutDimensions(id, layout.value)
    return {
      ...config,
      rows: dims.rows,
      cols: dims.cols,
      total: totalTilesForMode(id),
      visual:
        id === 'easy' ? '筒' : id === 'medium' ? '索' : '萬',
    }
  }),
)

const selectedDimensions = computed(() =>
  layoutDimensions(selectedMode.value, layout.value),
)

function recordText(mode: ModeId): string {
  const record = store.records[mode]
  if (record.wins === 0 || record.bestTimeMs === null) return ''
  return `最佳 ${formatTime(record.bestTimeMs)}`
}

function startGame(): void {
  if (!parsed.value.ok) return
  const seed = parsed.value.seed ?? randomSeed()
  const seedSource: SeedSource = parsed.value.seed === null ? 'random' : 'custom'
  writeUrlState(selectedMode.value, seed, layout.value)
  emit('start', {
    mode: selectedMode.value,
    seed,
    seedSource,
    layout: layout.value,
  })
}
</script>

<template>
  <main class="menu">
    <div class="menu-glow" aria-hidden="true"></div>
    <button
      type="button"
      class="icon-btn menu-settings"
      aria-label="打开设置"
      @click="settingsOpen = true"
    >
      ⚙
    </button>
    <SettingsPanel :open="settingsOpen" @close="settingsOpen = false" />
    <div class="menu-inner">
      <header class="hero">
        <p class="eyebrow">BLOCKJONG · 3D</p>
        <h1>挡通关</h1>
      </header>

      <section class="mode-section" aria-label="选择模式">
        <button
          v-for="mode in modeCards"
          :key="mode.id"
          type="button"
          class="mode-card"
          :class="{ selected: selectedMode === mode.id }"
          @click="selectedMode = mode.id"
        >
          <span
            class="mode-visual"
            :style="{ '--cols': mode.cols, '--rows': mode.rows }"
            aria-hidden="true"
          >
            <span class="visual-glyph">{{ mode.visual }}</span>
          </span>
          <span class="mode-body">
            <span class="mode-title">
              {{ mode.name }}
              <span class="mode-size">{{ mode.rows }} × {{ mode.cols }}</span>
            </span>
            <span class="mode-meta">{{ mode.total }} 张</span>
            <span v-if="store.records[mode.id].wins > 0" class="mode-record">
              {{ recordText(mode.id) }}
            </span>
          </span>
        </button>
      </section>

      <section class="launch" @keydown.enter="startGame">
        <div class="launch-main">
          <div class="layout-row">
            <span class="layout-label">布局</span>
            <div class="layout-switch" role="group" aria-label="布局方向">
              <button
                type="button"
                :class="{ active: layout === 'wide' }"
                :aria-pressed="layout === 'wide'"
                @click="layout = 'wide'"
              >
                横向
              </button>
              <button
                type="button"
                :class="{ active: layout === 'tall' }"
                :aria-pressed="layout === 'tall'"
                @click="layout = 'tall'"
              >
                纵向
              </button>
            </div>
            <span class="layout-size">
              {{ selectedDimensions.rows }} × {{ selectedDimensions.cols }}
            </span>
          </div>
          <button
            type="button"
            class="seed-toggle"
            :aria-expanded="seedOpen"
            @click="seedOpen = !seedOpen"
          >
            自定义种子
            <span aria-hidden="true">{{ seedOpen ? '－' : '＋' }}</span>
          </button>
          <div v-if="seedOpen" class="seed-body">
            <SeedInput v-model="seedText" :error="seedError" />
            <div class="seed-preview" :class="{ error: !parsed.ok }">
              {{ seedPreview }}
            </div>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-primary start-btn"
          :disabled="!canStart"
          @click="startGame"
        >
          <span>开始游戏</span>
          <span class="start-arrow" aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.menu {
  position: relative;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(1100px 700px at 50% -10%, #164236 0%, #0a1f19 45%, #050d0b 100%);
  color: var(--ivory);
}

.menu-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(600px 320px at 50% 18%, rgba(217, 179, 108, 0.09), transparent 70%),
    radial-gradient(circle at 50% 50%, transparent 45%, rgba(0, 0, 0, 0.55) 100%);
}

.menu-settings {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 6;
  font-size: 16px;
}

.menu-inner {
  position: relative;
  display: flex;
  width: min(1080px, calc(100% - 48px));
  min-height: 100vh;
  margin: 0 auto;
  padding: clamp(32px, 5vh, 60px) 0;
  flex-direction: column;
  justify-content: center;
  gap: clamp(26px, 4vh, 42px);
}

.hero {
  text-align: center;
}

.eyebrow {
  margin: 0 0 14px;
  color: var(--gold);
  font-size: 11px;
  letter-spacing: 0.38em;
}

h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(40px, 6vw, 72px);
  font-weight: 600;
  letter-spacing: 0.18em;
  text-shadow: 0 8px 40px rgba(0, 0, 0, 0.45);
}

.mode-section {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.mode-card {
  display: flex;
  align-items: stretch;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  background: rgba(9, 26, 21, 0.62);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.mode-card:hover {
  border-color: rgba(217, 179, 108, 0.32);
  transform: translateY(-2px);
}

.mode-card.selected {
  border-color: rgba(217, 179, 108, 0.7);
  background: linear-gradient(160deg, rgba(217, 179, 108, 0.12), rgba(9, 26, 21, 0.72));
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.32), inset 0 0 0 1px rgba(217, 179, 108, 0.1);
}

.mode-visual {
  position: relative;
  flex: 0 0 76px;
  align-self: center;
  aspect-ratio: var(--cols) / var(--rows);
  border-radius: 10px;
  border: 1px solid rgba(217, 179, 108, 0.35);
  background-color: #0c2a23;
  background-image:
    linear-gradient(rgba(217, 179, 108, 0.16) 1px, transparent 1px),
    linear-gradient(90deg, rgba(217, 179, 108, 0.16) 1px, transparent 1px);
  background-size:
    calc(100% / var(--cols)) calc(100% / var(--rows)),
    calc(100% / var(--cols)) calc(100% / var(--rows));
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  overflow: hidden;
}

.visual-glyph {
  font-family: var(--font-serif);
  font-size: 22px;
  color: rgba(243, 232, 208, 0.72);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.mode-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
}

.mode-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--font-serif);
  font-size: 21px;
  letter-spacing: 0.12em;
}

.mode-size {
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.mode-meta {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.03em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mode-record {
  color: var(--gold-soft);
  font-size: 11px;
  letter-spacing: 0.03em;
}

.launch {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 18px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: rgba(7, 20, 16, 0.72);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow-panel);
}

.launch-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.seed-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.layout-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.layout-label {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.1em;
}

.layout-switch {
  display: inline-flex;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.18);
}

.layout-switch button {
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
}

.layout-switch button.active {
  background: rgba(217, 179, 108, 0.16);
  color: var(--gold);
}

.layout-size {
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.seed-toggle {
  align-self: flex-start;
  padding: 4px 0;
  border: 0;
  border-bottom: 1px solid rgba(217, 179, 108, 0.22);
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.1em;
  cursor: pointer;
}

.seed-toggle:hover {
  border-color: rgba(217, 179, 108, 0.55);
  color: var(--ivory-dim);
}

.seed-preview {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.03em;
}

.seed-preview.error {
  color: #ef7a6d;
}

.start-btn {
  min-width: 190px;
  min-height: 52px;
  border-radius: 14px;
  font-size: 15px;
  letter-spacing: 0.1em;
}

.start-arrow {
  font-size: 18px;
  line-height: 1;
}

@media (max-width: 900px) {
  .mode-section {
    grid-template-columns: 1fr;
  }

  .launch {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .start-btn {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .menu-inner {
    width: calc(100% - 28px);
    padding-top: 32px;
  }

  h1 {
    font-size: 38px;
  }

  .mode-visual {
    flex-basis: 64px;
  }

  .mode-title {
    font-size: 18px;
  }
}
</style>
