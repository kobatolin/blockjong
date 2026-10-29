<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchConfig } from '@/api/client'
import type { ModeId, SeedSource } from '@/core/types'
import { useGameStore } from '@/stores/game'
import { parseUrlState } from '@/utils/url'
import GameView from './components/GameView.vue'
import MainMenu from './components/MainMenu.vue'

interface StartOptions {
  mode: ModeId
  seed: number
  seedSource: SeedSource
}

const store = useGameStore()
const initial = parseUrlState()
const screen = ref<'menu' | 'game'>('menu')
const menuMode = ref<ModeId>(initial.mode ?? 'easy')
const menuSeed = ref<number | null>(initial.seed)
const options = ref<StartOptions | null>(null)

function startGame(next: StartOptions): void {
  options.value = next
  screen.value = 'game'
}

function exitGame(): void {
  if (options.value) menuMode.value = options.value.mode
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
    @start="startGame"
  />
  <GameView
    v-else-if="options"
    :options="options"
    @exit="exitGame"
  />
</template>
