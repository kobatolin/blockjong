<script setup lang="ts">
import { computed } from 'vue'
import { formatTime } from '@/utils/format'

type DialogKind = 'won' | 'deadlock' | 'pause' | 'restart'

const props = defineProps<{
  kind: DialogKind | null
  timeMs: number
  moves: number
  remaining: number
  seedLabel: string
  isCustom: boolean
  canUndo: boolean
  itemUses: number
}>()

const emit = defineEmits<{
  resume: []
  undo: []
  item: []
  restart: []
  'new-game': []
  'same-seed': []
  exit: []
  'copy-link': []
  cancel: []
}>()

const title = computed(() => {
  switch (props.kind) {
    case 'won':
      return '一色清台'
    case 'deadlock':
      return '无可行操作'
    case 'pause':
      return '已暂停'
    case 'restart':
      return '重开本局？'
    default:
      return ''
  }
})

const subtitle = computed(() => {
  switch (props.kind) {
    case 'won':
      return '所有牌已消除，牌局完成。'
    case 'deadlock':
      return props.itemUses > 0
        ? '没有可点选的对子，也没有能通过拖动成对的操作。可用“移牌”挪开一张牌试试。'
        : '没有可点选的对子，也没有能通过拖动成对的操作。'
    case 'pause':
      return '计时已暂停，棋盘不会变化。'
    case 'restart':
      return '将回到同一 seed 的初始布局；同种子重开不计入最佳记录。'
    default:
      return ''
  }
})
</script>

<template>
  <Transition name="dialog">
    <div v-if="props.kind" class="dialog-backdrop" role="presentation">
      <section
        class="dialog panel"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <p class="eyebrow">
          {{ props.kind === 'won' ? 'COMPLETE' : props.kind === 'deadlock' ? 'NO MOVES' : 'PAUSED' }}
        </p>
        <h2>{{ title }}</h2>
        <p class="subtitle">{{ subtitle }}</p>

        <div v-if="props.kind === 'won' || props.kind === 'deadlock'" class="stats">
          <div>
            <b class="mono">{{ formatTime(props.timeMs) }}</b>
            <span>用时</span>
          </div>
          <div>
            <b>{{ props.moves }}</b>
            <span>步数</span>
          </div>
          <div>
            <b>{{ props.remaining }}</b>
            <span>剩余</span>
          </div>
        </div>

        <div v-if="props.kind !== 'restart'" class="seed-line">
          <span class="label">种子</span>
          <span class="mono seed">{{ props.seedLabel }}</span>
          <span v-if="props.isCustom" class="tag">自定义 · 不计入最佳</span>
          <button type="button" class="link-btn" @click="emit('copy-link')">
            复制分享链接
          </button>
        </div>

        <div v-if="props.kind === 'won'" class="actions">
          <button type="button" class="btn btn-primary" @click="emit('same-seed')">
            同种子再来
          </button>
          <button type="button" class="btn" @click="emit('new-game')">换一局</button>
          <button type="button" class="btn btn-ghost" @click="emit('exit')">返回主菜单</button>
        </div>

        <div v-else-if="props.kind === 'deadlock'" class="actions">
          <button
            v-if="props.itemUses > 0"
            type="button"
            class="btn"
            @click="emit('item')"
          >
            移牌（{{ props.itemUses }} 次）
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!props.canUndo"
            @click="emit('undo')"
          >
            撤销上一步
          </button>
          <button type="button" class="btn" @click="emit('restart')">重开本局</button>
          <button type="button" class="btn" @click="emit('new-game')">换一局</button>
          <button type="button" class="btn btn-ghost" @click="emit('exit')">返回主菜单</button>
        </div>

        <div v-else-if="props.kind === 'pause'" class="actions">
          <button type="button" class="btn btn-primary" @click="emit('resume')">继续</button>
          <button type="button" class="btn" @click="emit('restart')">重开本局</button>
          <button type="button" class="btn btn-ghost" @click="emit('exit')">返回主菜单</button>
        </div>

        <div v-else class="actions">
          <button type="button" class="btn btn-primary" @click="emit('restart')">
            确认重开
          </button>
          <button type="button" class="btn btn-ghost" @click="emit('cancel')">取消</button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.dialog-backdrop {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 8, 6, 0.58);
  backdrop-filter: blur(8px);
  z-index: 20;
}

.dialog {
  width: min(520px, 100%);
  padding: clamp(24px, 4vw, 36px);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(400px 220px at 50% 0%, rgba(217, 179, 108, 0.1), transparent 70%),
    rgba(8, 22, 18, 0.92);
  box-shadow: var(--shadow-panel), inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  text-align: center;
}

.eyebrow {
  margin: 0 0 12px;
  color: var(--gold);
  font-size: 10px;
  letter-spacing: 0.32em;
}

h2 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(28px, 4vw, 38px);
  font-weight: 600;
  letter-spacing: 0.14em;
}

.subtitle {
  margin: 12px auto 0;
  max-width: 380px;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.8;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 24px 0 18px;
}

.stats > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.16);
}

.stats b {
  color: var(--ivory);
  font-size: 20px;
  font-weight: 500;
}

.stats span {
  color: var(--muted);
  font-size: 9px;
  letter-spacing: 0.08em;
}

.seed-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--muted);
  font-size: 11px;
}

.seed {
  color: var(--ivory-dim);
}

.tag {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(217, 179, 108, 0.12);
  color: var(--gold-soft);
  font-size: 9px;
}

.link-btn {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gold);
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 9px;
  margin-top: 22px;
}

.actions .btn {
  flex: 1 1 140px;
  white-space: nowrap;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.24s ease;
}

.dialog-enter-active .dialog,
.dialog-leave-active .dialog {
  transition:
    transform 0.24s ease,
    opacity 0.24s ease;
}

/* Keep the dialog visible even if a transition frame is skipped (headless,
   reduced motion, throttled tab). Only the small offset is animated. */
.dialog-enter-from,
.dialog-leave-to {
  opacity: 1;
}

.dialog-enter-from .dialog,
.dialog-leave-to .dialog {
  opacity: 1;
  transform: translateY(10px) scale(0.98);
}

@media (max-width: 560px) {
  .dialog {
    padding: 24px 18px;
  }

  .actions .btn {
    flex-basis: 100%;
  }

  .link-btn {
    margin-left: 0;
    width: 100%;
  }
}
</style>
