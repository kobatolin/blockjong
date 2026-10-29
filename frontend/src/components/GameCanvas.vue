<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { GameRenderer } from '@/render/GameRenderer'

const host = ref<HTMLDivElement | null>(null)
let renderer: GameRenderer | null = null

onMounted(() => {
  if (!host.value) return
  renderer = new GameRenderer(host.value)
  renderer.start()
})

onBeforeUnmount(() => {
  renderer?.dispose()
  renderer = null
})
</script>

<template>
  <div ref="host" class="canvas-host"></div>
</template>

<style scoped>
.canvas-host {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.canvas-host :deep(.board-canvas) {
  width: 100%;
  height: 100%;
}
</style>
