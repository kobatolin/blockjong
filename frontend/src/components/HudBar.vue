<script setup lang="ts">
import { formatTime } from '@/utils/format'

const props = defineProps<{
  modeName: string
  remaining: number
  total: number
  moves: number
  elapsedMs: number
  seedLabel: string
  isCustom: boolean
  canUndo: boolean
  canHint: boolean
  paused: boolean
  soundOn: boolean
}>()

const emit = defineEmits<{
  undo: []
  hint: []
  restart: []
  pause: []
  exit: []
  'copy-seed': []
  'toggle-sound': []
  settings: []
}>()

const time = () => formatTime(props.elapsedMs)
</script>

<template>
  <header class="hud">
    <div class="hud-left">
      <button class="icon-btn" type="button" aria-label="返回主菜单" @click="emit('exit')">
        ←
      </button>
      <div class="mode-block">
        <span class="mode-name">{{ props.modeName }}</span>
        <button
          type="button"
          class="seed-chip"
          title="复制种子"
          @click="emit('copy-seed')"
        >
          <span class="seed-dot" aria-hidden="true"></span>
          <span class="mono">{{ props.seedLabel }}</span>
          <span v-if="props.isCustom" class="custom-tag">自定义</span>
        </button>
      </div>
    </div>

    <div class="stats" aria-label="对局状态">
      <div class="stat">
        <b>{{ props.remaining }}</b>
        <span>剩余 / {{ props.total }}</span>
      </div>
      <div class="stat">
        <b class="mono">{{ time() }}</b>
        <span>用时</span>
      </div>
      <div class="stat">
        <b>{{ props.moves }}</b>
        <span>步数</span>
      </div>
    </div>

    <div class="hud-right">
      <button
        class="icon-btn sound-btn"
        :class="{ off: !props.soundOn }"
        type="button"
        :aria-label="props.soundOn ? '关闭音效' : '开启音效'"
        :aria-pressed="props.soundOn"
        @click="emit('toggle-sound')"
      >
        {{ props.soundOn ? '♪' : '∅' }}
      </button>
      <button
        class="icon-btn"
        type="button"
        aria-label="打开设置"
        @click="emit('settings')"
      >
        ⚙
      </button>
      <button
        class="icon-btn pause-btn"
        type="button"
        :aria-label="props.paused ? '继续' : '暂停'"
        @click="emit('pause')"
      >
        {{ props.paused ? '▶' : 'Ⅱ' }}
      </button>
    </div>
  </header>

  <div class="dock" aria-label="操作">
    <button
      type="button"
      class="dock-btn"
      :disabled="!props.canUndo"
      @click="emit('undo')"
    >
      <span class="dock-icon" aria-hidden="true">↺</span>
      <span>撤销</span>
    </button>
    <button
      type="button"
      class="dock-btn"
      :disabled="!props.canHint"
      @click="emit('hint')"
    >
      <span class="dock-icon" aria-hidden="true">✦</span>
      <span>提示</span>
    </button>
    <button type="button" class="dock-btn" @click="emit('restart')">
      <span class="dock-icon" aria-hidden="true">⟳</span>
      <span>重开</span>
    </button>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(4, 11, 9, 0.72), transparent);
}

.hud-left,
.hud-right,
.stats {
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}

.mode-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sound-btn {
  font-size: 15px;
}

.sound-btn.off {
  color: var(--muted);
  opacity: 0.65;
}

.mode-name {
  font-family: var(--font-serif);
  font-size: 19px;
  letter-spacing: 0.16em;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
}

.seed-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 3px 8px;
  border: 1px solid rgba(217, 179, 108, 0.22);
  border-radius: 999px;
  background: rgba(7, 18, 15, 0.45);
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.05em;
  cursor: pointer;
}

.seed-chip:hover {
  border-color: rgba(217, 179, 108, 0.55);
  color: var(--ivory-dim);
}

.seed-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 8px rgba(217, 179, 108, 0.7);
}

.custom-tag {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(217, 179, 108, 0.13);
  color: var(--gold-soft);
  font-size: 9px;
  letter-spacing: 0.04em;
}

.stats {
  padding: 8px 14px;
  border: 1px solid rgba(217, 179, 108, 0.18);
  border-radius: 14px;
  background: rgba(7, 18, 15, 0.5);
  backdrop-filter: blur(10px);
}

.stat {
  display: flex;
  min-width: 58px;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat b {
  color: var(--ivory);
  font-size: 17px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.stat span {
  color: var(--muted);
  font-size: 9px;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.dock {
  position: absolute;
  bottom: max(20px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  padding: 7px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(7, 18, 15, 0.68);
  backdrop-filter: blur(14px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
}

.dock-btn {
  display: flex;
  min-width: 72px;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--ivory-dim);
  font-size: 10px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    opacity 0.18s ease;
}

.dock-btn:hover:not(:disabled) {
  background: rgba(217, 179, 108, 0.12);
  color: var(--ivory);
}

.dock-btn:disabled {
  opacity: 0.32;
  cursor: not-allowed;
}

.dock-icon {
  color: var(--gold);
  font-size: 17px;
  line-height: 1.2;
}

.pause-btn {
  font-size: 14px;
}

@media (max-width: 760px) {
  .hud {
    padding: 12px;
    flex-wrap: wrap;
  }

  .stats {
    order: 3;
    width: 100%;
    justify-content: space-around;
    padding: 6px 10px;
  }

  .stat {
    min-width: 48px;
  }

  .stat b {
    font-size: 15px;
  }

  .mode-name {
    font-size: 16px;
  }

  .dock {
    bottom: max(12px, env(safe-area-inset-bottom));
  }

  .dock-btn {
    min-width: 64px;
  }
}
</style>
