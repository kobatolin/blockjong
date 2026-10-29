<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function clear(): void {
  emit('update:modelValue', '')
}
</script>

<template>
  <label class="seed-input" :class="{ invalid: Boolean(props.error) }">
    <span class="seed-label">
      种子
      <em>可选</em>
    </span>

    <span class="seed-field">
      <span class="hash" aria-hidden="true">#</span>
      <input
        :value="props.modelValue"
        type="text"
        inputmode="text"
        maxlength="12"
        spellcheck="false"
        autocomplete="off"
        placeholder="留空随机，或 12345 / 0xA1B2C3D4"
        :aria-invalid="Boolean(props.error)"
        :disabled="props.disabled"
        @input="onInput"
      />
      <button
        v-if="props.modelValue"
        type="button"
        class="clear"
        aria-label="清空种子"
        @click="clear"
      >
        ×
      </button>
    </span>

    <span v-if="props.error" class="error" role="alert">{{ props.error }}</span>
    <span v-else class="hint">留空 = 随机种子；也可输入 0x 开头的十六进制</span>
  </label>
</template>

<style scoped>
.seed-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.seed-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--ivory-dim);
  font-size: 12px;
  letter-spacing: 0.14em;
}

.seed-label em {
  color: var(--muted);
  font-size: 10px;
  font-style: normal;
  letter-spacing: 0.08em;
}

.seed-field {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 12px;
  border: 1px solid rgba(217, 179, 108, 0.2);
  border-radius: 12px;
  background: rgba(4, 12, 10, 0.55);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.seed-field:focus-within {
  border-color: rgba(217, 179, 108, 0.65);
  box-shadow: 0 0 0 3px rgba(217, 179, 108, 0.1);
}

.invalid .seed-field {
  border-color: rgba(239, 122, 109, 0.65);
  box-shadow: 0 0 0 3px rgba(239, 122, 109, 0.08);
}

.hash {
  color: var(--gold-soft);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 14px;
}

input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ivory);
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 14px;
  letter-spacing: 0.04em;
}

input::placeholder {
  color: rgba(143, 168, 159, 0.55);
  font-family: var(--font-sans);
  font-size: 12px;
  letter-spacing: 0.02em;
}

.clear {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.clear:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--ivory);
}

.hint,
.error {
  font-size: 11px;
  line-height: 1.5;
  letter-spacing: 0.02em;
}

.hint {
  color: var(--muted);
}

.error {
  color: #ef7a6d;
}
</style>
