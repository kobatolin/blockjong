<script setup lang="ts">
defineProps<{
  message: string
  visible: boolean
}>()
</script>

<template>
  <Transition name="toast">
    <div v-if="visible && message" class="toast" role="status">
      {{ message }}
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: absolute;
  left: 50%;
  bottom: calc(max(20px, env(safe-area-inset-bottom)) + 86px);
  transform: translateX(-50%);
  max-width: min(420px, calc(100% - 40px));
  padding: 10px 18px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(8, 22, 18, 0.88);
  backdrop-filter: blur(12px);
  color: var(--ivory-dim);
  font-size: 12px;
  letter-spacing: 0.04em;
  text-align: center;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.4);
  z-index: 30;
  pointer-events: none;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}
</style>
