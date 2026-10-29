<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ done: [] }>()

const steps = [
  {
    title: '点选两张同牌',
    body: '两张牌必须位于同一行或同一列，且中间没有其他牌阻挡。',
    detail: '看不清时点“提示”，金色标记会指出一组可行操作。',
  },
  {
    title: '按住牌拖动',
    body: '沿行或列拖动时，被按住的牌和拖动方向上连续的牌会一起移动。',
    detail: '松手时被拖的牌必须能配对，否则整串会回弹；满盘时先点选消出空格。',
  },
  {
    title: '死局没有洗牌',
    body: '没有可点选的对子、也没有能成对的拖动时，本局进入死局。',
    detail: '可以撤销上一步、重开本局或换一局。自定义种子不计入最佳记录。',
  },
]

const step = ref(0)

function next(): void {
  if (step.value < steps.length - 1) {
    step.value += 1
  } else {
    emit('done')
  }
}

function skip(): void {
  emit('done')
}
</script>

<template>
  <Teleport to="body">
    <div class="tutorial-backdrop">
      <section
        class="tutorial-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        <p class="eyebrow">HOW TO PLAY</p>
        <div class="tutorial-head">
          <span class="step-number">0{{ step + 1 }} / 03</span>
          <div class="dots" aria-hidden="true">
            <span
              v-for="(_, index) in steps"
              :key="index"
              :class="{ active: index === step }"
            ></span>
          </div>
        </div>

        <h2 id="tutorial-title">{{ steps[step].title }}</h2>
        <p class="body">{{ steps[step].body }}</p>
        <p class="detail">{{ steps[step].detail }}</p>

        <div class="tutorial-actions">
          <button type="button" class="btn btn-ghost" @click="skip">跳过</button>
          <button type="button" class="btn btn-primary" @click="next">
            {{ step < steps.length - 1 ? '下一步' : '开始对局' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.tutorial-backdrop {
  position: fixed;
  inset: 0;
  z-index: 55;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 8, 6, 0.62);
  backdrop-filter: blur(7px);
}

.tutorial-panel {
  width: min(520px, 100%);
  padding: clamp(24px, 5vw, 38px);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(420px 220px at 50% 0%, rgba(217, 179, 108, 0.1), transparent 70%),
    rgba(8, 22, 18, 0.97);
  box-shadow: var(--shadow-panel), inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

.eyebrow {
  margin: 0 0 18px;
  color: var(--gold);
  font-size: 10px;
  letter-spacing: 0.3em;
  text-align: center;
}

.tutorial-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.step-number {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.18em;
}

.dots {
  display: flex;
  gap: 7px;
}

.dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
}

.dots span.active {
  background: var(--gold);
  box-shadow: 0 0 10px rgba(217, 179, 108, 0.6);
}

h2 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(28px, 5vw, 36px);
  font-weight: 600;
  letter-spacing: 0.12em;
}

.body {
  margin: 18px 0 0;
  color: var(--ivory-dim);
  font-size: 14px;
  line-height: 1.9;
}

.detail {
  margin: 12px 0 0;
  padding: 12px 14px;
  border-left: 2px solid rgba(217, 179, 108, 0.5);
  background: rgba(217, 179, 108, 0.06);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
}

.tutorial-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 26px;
}

.tutorial-actions .btn {
  min-width: 120px;
}

.tutorial-actions .btn-ghost {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: var(--muted);
}

@media (max-width: 520px) {
  .tutorial-backdrop {
    padding: 12px;
  }

  .tutorial-actions {
    flex-direction: column-reverse;
  }

  .tutorial-actions .btn {
    width: 100%;
  }
}
</style>
