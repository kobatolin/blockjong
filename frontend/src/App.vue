<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { fetchConfig } from '@/api/client'
import type { Layout, ModeId, SeedSource } from '@/core/types'
import { useGameStore } from '@/stores/game'
import { parseUrlState } from '@/utils/url'
import GameView from './components/GameView.vue'
import MainMenu from './components/MainMenu.vue'

interface StartOptions {
  mode: ModeId
  seed: number
  seedSource: SeedSource
  layout: Layout
}

function defaultLayout(): Layout {
  if (typeof window === 'undefined') return 'wide'
  return window.innerWidth > window.innerHeight ? 'wide' : 'tall'
}

const store = useGameStore()
const initial = parseUrlState()
const hasLegacyUrlState = initial.mode !== null || initial.seed !== null
const screen = ref<'menu' | 'game'>('menu')
const menuMode = ref<ModeId>(initial.mode ?? 'easy')
const menuSeed = ref<number | null>(initial.seed)
const menuLayout = ref<Layout>(
  initial.layout ?? (hasLegacyUrlState ? 'wide' : defaultLayout()),
)
const options = ref<StartOptions | null>(null)

watch(
  () => store.motion,
  (value) => {
    document.documentElement.classList.toggle('reduced-motion', value === 'reduced')
  },
  { immediate: true },
)

function startGame(next: StartOptions): void {
  options.value = next
  screen.value = 'game'
}

function exitGame(): void {
  if (options.value) {
    menuMode.value = options.value.mode
    menuLayout.value = options.value.layout
  }
  menuSeed.value = null
  screen.value = 'menu'
}

onMounted(async () => {
  const config = await fetchConfig()
  if (config) store.setServerVersion(config.version)
})
</script>

<template>
  <MainMenu
    v-if="screen === 'menu'"
    :initial-mode="menuMode"
    :initial-seed="menuSeed"
    :initial-layout="menuLayout"
    @start="startGame"
  />
  <GameView
    v-else-if="options"
    :options="options"
    @exit="exitGame"
  />
</template>
