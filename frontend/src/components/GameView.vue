<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { boardSignature, tileById } from '@/core/board'
import { findAnyDrag, findAssistedTap, newVisiblePartners, segment, type AnyMove } from '@/core/drag'
import { MODE_CONFIGS, totalTilesForMode } from '@/core/kinds'
import { findVisiblePartners } from '@/core/rules'
import { formatSeed, formatSeedHex, randomSeed } from '@/core/seed'
import { GameSession } from '@/core/session'
import type { Dir, GameSnapshot, ModeId, SeedSource } from '@/core/types'
import { GameRenderer, DEFAULT_RENDER_TUNING, type DragPreviewInfo, type DragStartInfo, type GameRendererCallbacks, type RenderTuning } from '@/render/GameRenderer'
import { Sfx } from '@/render/audio'
import { useGameStore } from '@/stores/game'
import { buildShareUrl, copyText, writeUrlState } from '@/utils/url'
import GameDialog from './GameDialog.vue'
import HudBar from './HudBar.vue'
import LightingPanel from './LightingPanel.vue'
import SettingsPanel from './SettingsPanel.vue'
import Toast from './Toast.vue'
import TutorialOverlay from './TutorialOverlay.vue'

type DialogKind = 'won' | 'deadlock' | 'pause' | 'restart'

interface StartOptions {
  mode: ModeId
  seed: number
  seedSource: SeedSource
}

interface MahjDebugApi {
  snapshot: () => GameSnapshot
  signature: () => string
  hint: () => AnyMove | null
  findDrag: () => {
    tileId: number
    row: number
    col: number
    dir: Dir
    k: number
    partnerId: number
  } | null
  cellToScreen: (row: number, col: number) => { x: number; y: number } | null
  preview: (tileId: number, dir: Dir, k: number) => {
    kind: string
    k: number
    kMax: number
    partnerId: number | null
    moved: Array<{ id: number; row: number; col: number }>
  } | null
  assistMove: () => {
    a: { id: number; row: number; col: number }
    b: { id: number; row: number; col: number }
    dir: Dir
    k: number
  } | null
  findChoice: () => {
    tileId: number
    row: number
    col: number
    dir: Dir
    k: number
    candidates: Array<{ id: number; row: number; col: number }>
  } | null
  lightingState: () => {
    keyIntensity: number
    exposure: number
    bodyRoughness: number
    bodyEnvMapIntensity: number
    face: { type: string; roughness: number; envMapIntensity: number } | null
  } | null
  tap: (row: number, col: number) => void
  drag: (tileId: number, dir: Dir, k: number) => void
  itemUses: () => number
  itemActive: () => boolean
  itemTargets: () => Array<{ row: number; col: number }>
  itemToggle: () => void
  uiState: () => {
    busy: boolean
    dialog: DialogKind | null
    interactive: boolean
    awaitingChoice: boolean
  } | null
}

const props = defineProps<{ options: StartOptions }>()
const emit = defineEmits<{ exit: [] }>()

const store = useGameStore()
const sfx = new Sfx()
sfx.setEnabled(store.sound)
const config = MODE_CONFIGS[props.options.mode]
const total = totalTilesForMode(props.options.mode)

let session = GameSession.create(
  props.options.mode,
  props.options.seed,
  props.options.seedSource,
)

const host = ref<HTMLDivElement | null>(null)
const snapshot = ref<GameSnapshot>(session.snapshot())
const elapsedMs = ref(0)
const running = ref(false)
const busy = ref(false)
const awaitingChoice = ref(false)
const dialog = ref<DialogKind | null>(null)
const settingsOpen = ref(false)
const tutorialOpen = ref(false)
const restartOrigin = ref<Exclude<DialogKind, 'restart'> | null>(null)
const canUndo = ref(false)
const canHint = ref(true)
const partnerIds = ref<number[]>([])
const seedLabel = ref(formatSeed(session.seed))
const isCustom = ref(session.seedSource === 'custom')
const toastMessage = ref('')
const toastVisible = ref(false)
const debugMode = new URLSearchParams(window.location.search).get('debug') === '1'

let renderer: GameRenderer | null = null
let timerId: number | null = null
let timerStartedAt = 0
let accumulatedMs = 0
let timerRunning = false
let toastTimer: number | null = null
let recorded = false

function elapsedNow(): number {
  return accumulatedMs + (timerRunning ? performance.now() - timerStartedAt : 0)
}

function startTimer(): void {
  if (timerRunning) return
  timerStartedAt = performance.now()
  timerRunning = true
  running.value = true
  if (timerId !== null) window.clearInterval(timerId)
  timerId = window.setInterval(() => {
    elapsedMs.value = elapsedNow()
  }, 200)
}

function pauseTimer(): void {
  if (!timerRunning) return
  accumulatedMs += performance.now() - timerStartedAt
  timerRunning = false
  running.value = false
  elapsedMs.value = accumulatedMs
  if (timerId !== null) {
    window.clearInterval(timerId)
    timerId = null
  }
}

function stopTimer(): void {
  pauseTimer()
}

function resetTimer(): void {
  pauseTimer()
  accumulatedMs = 0
  elapsedMs.value = 0
  startTimer()
}

function showToast(message: string): void {
  toastMessage.value = message
  toastVisible.value = true
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastVisible.value = false
  }, 1900)
}

function syncView(): void {
  const snap = session.snapshot()
  snapshot.value = snap

  const partners: number[] = []
  if (snap.selectedId !== null) {
    const tile = tileById(snap.board, snap.selectedId)
    if (tile) {
      for (const partner of findVisiblePartners(snap.board, tile)) {
        partners.push(partner.id)
      }
    }
  }
  partnerIds.value = partners

  canUndo.value = session.historySize > 0 && snap.phase !== 'won'
  canHint.value = snap.phase === 'idle' && !busy.value && !snap.itemActive
  renderer?.setState(snap.selectedId, partners)
  renderer?.setItemPreview(snap.itemTileId, session.itemTargets())

  if (snap.phase === 'won') {
    handleWon()
  } else if (snap.phase === 'deadlock') {
    if (!snap.itemActive) handleDeadlock()
  } else if (dialog.value === 'deadlock') {
    // The item (or undo) rescued the board; drop the deadlock dialog.
    dialog.value = null
    if (!busy.value) renderer?.setInteractive(true)
    startTimer()
  }
}

function handleWon(): void {
  if (dialog.value === 'won') return
  stopTimer()
  sfx.win()
  const finalTime = elapsedMs.value
  if (!recorded && session.seedSource === 'random') {
    store.recordWin(session.mode, finalTime)
    recorded = true
  }
  dialog.value = 'won'
  renderer?.setInteractive(false)
}

function handleDeadlock(): void {
  if (dialog.value === 'deadlock') return
  stopTimer()
  sfx.deadlock()
  dialog.value = 'deadlock'
  renderer?.setInteractive(false)
}

function applyDebugTuning(tuning: RenderTuning): void {
  renderer?.setTuning(tuning)
}

function handleTap(_tileId: number, row: number, col: number): void {
  if (busy.value || dialog.value) return
  const result = session.tap(row, col)
  if (debugMode) console.info('[mahj] tap', { row, col, kind: result.kind })
  if (result.kind === 'selected') sfx.select()
  else if (result.kind === 'matched' || result.kind === 'assisted') sfx.match()
  else if (result.kind === 'choiceMatched') sfx.match()
  else if (result.kind === 'choiceCancelled') sfx.revert()
  else if (result.kind === 'switched') sfx.revert()
  else if (result.kind === 'cleared' && result.hadSelection) sfx.click()

  if (result.kind === 'itemSelected') {
    sfx.select()
    syncView()
    return
  }
  if (result.kind === 'itemRejected') {
    sfx.revert()
    showToast(
      result.reason === 'no-space'
        ? '这张牌四周没有空格'
        : result.reason === 'no-uses'
          ? '移牌次数已用完'
          : '只能移到上下左右相邻的空格',
    )
    syncView()
    return
  }
  if (result.kind === 'itemCancelled') {
    sfx.click()
    syncView()
    return
  }
  if (result.kind === 'itemMoved') {
    sfx.item()
    showToast(`已移牌，剩余 ${result.itemUsesLeft} 次`)
    busy.value = true
    renderer?.setInteractive(false)
    if (!renderer) {
      busy.value = false
      syncView()
      return
    }
    renderer.playItemMove(result.tile, result.to, result.board, () => {
      busy.value = false
      syncView()
      renderer?.setInteractive(dialog.value === null)
    })
    return
  }
  if (result.kind === 'choiceMatched' || result.kind === 'choiceCancelled') {
    awaitingChoice.value = false
    renderer?.clearChoice()
    busy.value = true
    renderer?.setInteractive(false)
    if (!renderer) {
      busy.value = false
      syncView()
      return
    }
    if (result.kind === 'choiceMatched') {
      renderer.playMatch(result.pair, result.board, () => {
        busy.value = false
        syncView()
        renderer?.setInteractive(dialog.value === null)
      })
    } else {
      renderer.playRevert(result.moved, () => {
        busy.value = false
        syncView()
        renderer?.setInteractive(dialog.value === null)
      })
    }
    return
  }
  if (result.kind === 'assisted') {
    busy.value = true
    renderer?.setInteractive(false)
    if (!renderer) {
      busy.value = false
      syncView()
      return
    }
    renderer.playAssistedMatch(result.moved, result.pair, result.board, () => {
      busy.value = false
      syncView()
      renderer?.setInteractive(dialog.value === null)
      if (debugMode) {
        console.info('[mahj] assistedTapDone', {
          dir: result.dir,
          k: result.k,
          busy: busy.value,
          dialog: dialog.value,
        })
      }
    })
    return
  }
  if (result.kind === 'matched') {
    busy.value = true
    renderer?.setInteractive(false)
    if (!renderer) {
      busy.value = false
      syncView()
      return
    }
    renderer.playMatch(result.pair, result.board, () => {
      busy.value = false
      syncView()
      renderer?.setInteractive(dialog.value === null)
      if (debugMode) {
        console.info('[mahj] tapMatchDone', {
          busy: busy.value,
          dialog: dialog.value,
          interactive: renderer?.isInteractive(),
        })
      }
    })
    return
  }
  if (result.kind === 'switched') {
    showToast(result.reason === 'blocked' ? '中间有牌挡住' : '两张牌不一样')
  }
  syncView()
}

function handleDragStart(
  _tileId: number,
  row: number,
  col: number,
  dir: Dir,
): DragStartInfo | null {
  if (busy.value || dialog.value || awaitingChoice.value) return null
  const info = session.dragInfo(row, col)
  if (!info) return null
  const board = session.getBoard()
  const segmentIds = segment(board, info.tile, dir).map((tile) => tile.id)
  if (debugMode) {
    console.info('[mahj] dragStart', { row, col, dir, ranges: info.ranges, segmentIds })
  }
  return {
    ranges: info.ranges,
    segmentIds,
    anchorId: session.selected,
  }
}

function handleDragMove(tileId: number, dir: Dir, k: number): DragPreviewInfo | null {
  if (busy.value || dialog.value) return null
  const resolution = session.dragPreview(tileId, dir, k)
  if (!resolution) return null
  if (debugMode) {
    console.info('[mahj] dragMove', {
      tileId,
      dir,
      k: resolution.k,
      kind: resolution.kind,
      partner: resolution.partner?.id ?? null,
    })
  }
  return {
    k: resolution.k,
    kMax: resolution.kMax,
    partnerId: resolution.partner?.id ?? null,
    movedIds: resolution.moved.map((tile) => tile.id),
    targetCells: resolution.moved.map((tile) => ({ row: tile.row, col: tile.col })),
  }
}

function handleDragEnd(tileId: number, dir: Dir, k: number): void {
  if (busy.value || dialog.value || awaitingChoice.value) {
    renderer?.resetDrag()
    return
  }

  busy.value = true
  renderer?.setInteractive(false)
  const result = session.dragEnd(tileId, dir, k)
  if (debugMode) {
    console.info('[mahj] dragEnd', { tileId, dir, k, kind: result.kind })
  }

  if (result.kind === 'choice') {
    awaitingChoice.value = true
    busy.value = false
    renderer?.setInteractive(true)
    renderer?.showChoice(result.candidates.map((tile) => tile.id))
    showToast('点击一张高亮牌消除，点其它位置让牌归位')
    return
  }

  if (!renderer) {
    busy.value = false
    syncView()
    return
  }

  if (result.kind === 'matched') {
    sfx.match()
    renderer.playMatch(result.pair, result.board, () => {
      busy.value = false
      syncView()
      renderer?.setInteractive(dialog.value === null)
    })
    return
  }

  if (result.kind === 'reverted') {
    sfx.revert()
    renderer.playRevert(result.moved, () => {
      busy.value = false
      syncView()
      renderer?.setInteractive(dialog.value === null)
    })
    return
  }

  renderer.resetDrag()
  busy.value = false
  syncView()
  renderer.setInteractive(true)
}

function handleDragCancel(): void {
  busy.value = false
  renderer?.resetDrag()
  syncView()
}

function handleUndo(): void {
  if (busy.value) return
  if (snapshot.value.itemActive) {
    session.cancelItemMove()
    sfx.click()
    syncView()
    return
  }
  if (awaitingChoice.value) {
    const moved = session.cancelChoice()
    awaitingChoice.value = false
    renderer?.clearChoice()
    if (!moved || !renderer) {
      syncView()
      return
    }
    busy.value = true
    sfx.click()
    renderer.setInteractive(false)
    renderer.playRevert(moved, () => {
      busy.value = false
      syncView()
      renderer?.setInteractive(dialog.value === null)
    })
    return
  }
  if (!session.undo()) {
    showToast('没有可撤销的操作')
    return
  }
  dialog.value = null
  restartOrigin.value = null
  sfx.click()
  renderer?.setBoard(session.getBoard())
  renderer?.setInteractive(true)
  syncView()
  if (session.phaseNow === 'idle') startTimer()
}

function handleHint(): void {
  if (busy.value || dialog.value) return
  if (snapshot.value.itemActive) {
    showToast('先退出移牌模式再使用提示')
    return
  }
  if (awaitingChoice.value) {
    showToast('请先选择一张高亮牌，或点其它位置归位')
    return
  }
  const move = session.hint()
  if (!move) {
    showToast('当前没有可行操作')
    return
  }
  if (move.kind === 'tap') {
    renderer?.showHint([move.a.id, move.b.id])
    sfx.hint()
    showToast('提示：这两张可以消除')
    return
  }
  const dirText: Record<Dir, string> = {
    left: '左',
    right: '右',
    up: '上',
    down: '下',
  }
  renderer?.showHint([move.move.tile.id, move.move.partner.id])
  sfx.hint()
  showToast(
    `提示：把第 ${move.move.tile.row + 1} 行第 ${move.move.tile.col + 1} 列的牌向${dirText[move.move.dir]}拖`,
  )
}

function toggleItem(): void {
  if (busy.value || dialog.value) return
  if (awaitingChoice.value) {
    showToast('请先选择一张高亮牌，或点其它位置归位')
    return
  }
  if (snapshot.value.itemActive) {
    session.cancelItemMove()
    sfx.click()
    syncView()
    return
  }
  if (!session.beginItemMove()) {
    showToast(
      session.itemUsesLeft === 0
        ? '移牌次数已用完'
        : !session.itemMovable()
          ? '先消掉一对牌，才有空格可以移'
          : '现在不能使用移牌',
    )
    return
  }
  sfx.click()
  renderer?.setInteractive(true)
  syncView()
  showToast(`点一张牌，再点它上下左右的空格（剩余 ${session.itemUsesLeft} 次）`)
}

/** Deadlock dialog entry point: close it and enter item mode. */
function useItemFromDeadlock(): void {
  if (dialog.value !== 'deadlock') return
  if (!session.beginItemMove()) {
    showToast(
      session.itemUsesLeft === 0 ? '移牌次数已用完' : '棋盘没有空格，移牌无法使用',
    )
    return
  }
  dialog.value = null
  renderer?.setInteractive(true)
  sfx.click()
  syncView()
  showToast(`点一张牌，再点它上下左右的空格（剩余 ${session.itemUsesLeft} 次）`)
}

function openPause(): void {
  if (busy.value || dialog.value || settingsOpen.value) return
  if (snapshot.value.itemActive) {
    session.cancelItemMove()
    syncView()
  }
  sfx.click()
  dialog.value = 'pause'
  pauseTimer()
  renderer?.setInteractive(false)
}

function resumeGame(): void {
  if (dialog.value !== 'pause') return
  dialog.value = null
  renderer?.setInteractive(true)
  if (session.phaseNow === 'idle') startTimer()
}

function toggleSound(): void {
  store.setSound(!store.sound)
  sfx.setEnabled(store.sound)
  if (store.sound) sfx.click()
}

function openSettings(): void {
  if (busy.value || settingsOpen.value || dialog.value || tutorialOpen.value) return
  if (snapshot.value.itemActive) {
    session.cancelItemMove()
    syncView()
  }
  settingsOpen.value = true
  pauseTimer()
  renderer?.setInteractive(false)
  sfx.click()
}

function closeSettings(): void {
  if (!settingsOpen.value) return
  settingsOpen.value = false
  if (dialog.value === null) {
    renderer?.setInteractive(true)
    if (session.phaseNow === 'idle') startTimer()
  }
}

const TUTORIAL_KEY = 'mahj.tutorial.v1'

function shouldShowTutorial(): boolean {
  if (debugMode) return false
  try {
    return globalThis.localStorage?.getItem(TUTORIAL_KEY) !== 'done'
  } catch {
    return true
  }
}

function finishTutorial(): void {
  tutorialOpen.value = false
  try {
    globalThis.localStorage?.setItem(TUTORIAL_KEY, 'done')
  } catch {
    // ignore storage errors
  }
  renderer?.setInteractive(dialog.value === null)
  if (dialog.value === null && session.phaseNow === 'idle') startTimer()
}

function openRestart(): void {
  if (busy.value || dialog.value === 'restart') return
  restartOrigin.value =
    dialog.value === 'won' || dialog.value === 'deadlock' || dialog.value === 'pause'
      ? dialog.value
      : null
  dialog.value = 'restart'
  pauseTimer()
  renderer?.setInteractive(false)
}

function cancelRestart(): void {
  if (dialog.value !== 'restart') return
  const origin = restartOrigin.value
  restartOrigin.value = null
  dialog.value = origin
  renderer?.setInteractive(origin === null)
  if (origin === null && session.phaseNow === 'idle') startTimer()
}

function confirmRestart(): void {
  startSession(session.mode, session.seed, 'custom')
}

function handleRestartAction(): void {
  if (dialog.value === 'restart') confirmRestart()
  else openRestart()
}

function startSession(mode: ModeId, seed: number, seedSource: SeedSource): void {
  pauseTimer()
  session = GameSession.create(mode, seed, seedSource)
  snapshot.value = session.snapshot()
  seedLabel.value = formatSeed(session.seed)
  isCustom.value = seedSource === 'custom'
  partnerIds.value = []
  dialog.value = null
  restartOrigin.value = null
  busy.value = false
  awaitingChoice.value = false
  renderer?.clearChoice()
  recorded = false
  accumulatedMs = 0
  elapsedMs.value = 0
  renderer?.setBoard(session.getBoard())
  renderer?.setInteractive(true)
  writeUrlState(mode, seed)
  syncView()
  startTimer()
}

function handleNewGame(): void {
  startSession(session.mode, randomSeed(), 'random')
}

function handleSameSeed(): void {
  startSession(session.mode, session.seed, 'custom')
}

async function copySeed(): Promise<void> {
  const ok = await copyText(formatSeedHex(session.seed))
  if (ok) sfx.click()
  showToast(ok ? '种子已复制' : '复制失败')
}

async function copyLink(): Promise<void> {
  const ok = await copyText(buildShareUrl(session.mode, session.seed))
  if (ok) sfx.click()
  showToast(ok ? '分享链接已复制' : '复制失败')
}

function exitGame(): void {
  pauseTimer()
  emit('exit')
}

const callbacks: GameRendererCallbacks = {
  onTap: handleTap,
  onDragStart: handleDragStart,
  onDragMove: handleDragMove,
  onDragEnd: handleDragEnd,
  onDragCancel: handleDragCancel,
}

watch(
  () => store.sound,
  (value) => sfx.setEnabled(value),
)
watch(
  () => store.quality,
  (value) => renderer?.setQuality(value),
)
watch(
  () => store.motion,
  (value) => renderer?.setMotion(value),
)
watch(
  () => [
    store.lightIntensity,
    store.lightTemperature,
    store.tileRoughness,
    store.tileReflectivity,
  ] as const,
  () =>
    renderer?.setLighting({
      intensity: store.lightIntensity,
      temperature: store.lightTemperature,
      roughness: store.tileRoughness,
      reflectivity: store.tileReflectivity,
    }),
)

function onVisibilityChange(): void {
  if (document.hidden) {
    pauseTimer()
    return
  }
  if (session.phaseNow === 'idle' && dialog.value === null && !settingsOpen.value && !tutorialOpen.value) {
    startTimer()
  }
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  ) {
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (tutorialOpen.value) return

  if (event.key === 'Escape') {
    if (settingsOpen.value) {
      closeSettings()
      event.preventDefault()
      return
    }
    if (dialog.value === 'pause') {
      resumeGame()
      event.preventDefault()
      return
    }
    if (dialog.value === 'restart') {
      cancelRestart()
      event.preventDefault()
      return
    }
    return
  }

  if (dialog.value !== null || settingsOpen.value) return
  const key = event.key.toLowerCase()
  if (key === 'u') {
    handleUndo()
    event.preventDefault()
  } else if (key === 'h') {
    handleHint()
    event.preventDefault()
  } else if (key === 'i') {
    toggleItem()
    event.preventDefault()
  } else if (key === 'p') {
    openPause()
    event.preventDefault()
  } else if (key === 'r') {
    openRestart()
    event.preventDefault()
  }
}

function installDebugBridge(): void {
  if (new URLSearchParams(window.location.search).get('debug') !== '1') return
  const api: MahjDebugApi = {
    snapshot: () => session.snapshot(),
    signature: () => boardSignature(session.getBoard()),
    hint: () => session.hint(),
    findDrag: () => {
      const move = findAnyDrag(session.getBoard())
      if (!move) return null
      return {
        tileId: move.tile.id,
        row: move.tile.row,
        col: move.tile.col,
        dir: move.dir,
        k: move.k,
        partnerId: move.partner.id,
      }
    },
    cellToScreen: (row, col) => renderer?.cellToScreen(row, col) ?? null,
    preview: (tileId, dir, k) => {
      const resolution = session.dragPreview(tileId, dir, k)
      if (!resolution) return null
      return {
        kind: resolution.kind,
        k: resolution.k,
        kMax: resolution.kMax,
        partnerId: resolution.partner?.id ?? null,
        moved: resolution.moved.map((tile) => ({
          id: tile.id,
          row: tile.row,
          col: tile.col,
        })),
      }
    },
    assistMove: () => {
      const board = session.getBoard()
      const tiles = board.cells.filter((tile): tile is NonNullable<typeof tile> => Boolean(tile))
      for (let i = 0; i < tiles.length; i += 1) {
        for (let j = i + 1; j < tiles.length; j += 1) {
          const move = findAssistedTap(board, tiles[i], tiles[j])
          if (move) {
            return {
              a: { id: tiles[i].id, row: tiles[i].row, col: tiles[i].col },
              b: { id: tiles[j].id, row: tiles[j].row, col: tiles[j].col },
              dir: move.dir,
              k: move.k,
            }
          }
        }
      }
      return null
    },
    findChoice: () => {
      const board = session.getBoard()
      const tiles = board.cells.filter((tile): tile is NonNullable<typeof tile> => Boolean(tile))
      for (const tile of tiles) {
        for (const dir of ['left', 'right', 'up', 'down'] as Dir[]) {
          const info = session.dragInfo(tile.row, tile.col)
          const kMax = info?.ranges[dir] ?? 0
          for (let k = 1; k <= kMax; k += 1) {
            const resolution = session.dragPreview(tile.id, dir, k)
            if (
              resolution?.kind !== 'match' ||
              !resolution.dragged ||
              !resolution.partner
            ) {
              continue
            }
            const candidates = newVisiblePartners(board, resolution.preview, resolution.dragged)
            if (candidates.length > 1 && session.selected === null) {
              return {
                tileId: tile.id,
                row: tile.row,
                col: tile.col,
                dir,
                k,
                candidates: candidates.map((candidate) => ({
                  id: candidate.id,
                  row: candidate.row,
                  col: candidate.col,
                })),
              }
            }
          }
        }
      }
      return null
    },
    lightingState: () => renderer?.getLightingState() ?? null,
    tap: (row, col) => handleTap(-1, row, col),
    drag: (tileId, dir, k) => handleDragEnd(tileId, dir, k),
    itemUses: () => session.itemUsesLeft,
    itemActive: () => session.itemActiveNow,
    itemTargets: () => session.itemTargets(),
    itemToggle: () => toggleItem(),
    uiState: () => ({
      busy: busy.value,
      dialog: dialog.value,
      interactive: renderer?.isInteractive() ?? false,
      awaitingChoice: awaitingChoice.value,
    }),
  }
  ;(window as unknown as { __mahj?: MahjDebugApi }).__mahj = api
}

onMounted(() => {
  if (!host.value) return
  renderer = new GameRenderer(host.value, config.rows, config.cols, callbacks)
  renderer.setQuality(store.quality)
  renderer.setMotion(store.motion)
  renderer.setLighting({
    intensity: store.lightIntensity,
    temperature: store.lightTemperature,
    roughness: store.tileRoughness,
    reflectivity: store.tileReflectivity,
  })
  renderer.setBoard(session.getBoard())
  // Advanced defaults are applied after the board exists so every shared face
  // material receives the exact clearcoat/roughness/reflection values.
  renderer.setTuning({ ...DEFAULT_RENDER_TUNING })
  renderer.start()
  writeUrlState(session.mode, session.seed)
  syncView()
  startTimer()
  if (shouldShowTutorial()) {
    tutorialOpen.value = true
    pauseTimer()
    renderer.setInteractive(false)
  }
  installDebugBridge()
  document.addEventListener('visibilitychange', onVisibilityChange)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  document.removeEventListener('keydown', onKeydown)
  pauseTimer()
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  delete (window as unknown as { __mahj?: MahjDebugApi }).__mahj
  sfx.dispose()
  renderer?.dispose()
  renderer = null
})
</script>

<template>
  <div class="game-view">
    <div ref="host" class="game-stage"></div>
    <div class="vignette" aria-hidden="true"></div>

    <HudBar
      :mode-name="config.name"
      :remaining="snapshot.remaining"
      :total="total"
      :elapsed-ms="elapsedMs"
      :seed-label="seedLabel"
      :is-custom="isCustom"
      :can-undo="canUndo"
      :can-hint="canHint"
      :item-uses="snapshot.itemUses"
      :item-active="snapshot.itemActive"
      :can-item="snapshot.itemUses > 0 && snapshot.phase !== 'won' && !busy"
      :paused="!running"
      :sound-on="store.sound"
      @undo="handleUndo"
      @hint="handleHint"
      @item="toggleItem"
      @restart="openRestart"
      @pause="openPause"
      @exit="exitGame"
      @copy-seed="copySeed"
      @toggle-sound="toggleSound"
      @settings="openSettings"
    />

    <GameDialog
      :kind="dialog"
      :time-ms="elapsedMs"
      :remaining="snapshot.remaining"
      :seed-label="seedLabel"
      :is-custom="isCustom"
      :can-undo="canUndo"
      :item-uses="snapshot.itemUses"
      @resume="resumeGame"
      @undo="handleUndo"
      @item="useItemFromDeadlock"
      @restart="handleRestartAction"
      @new-game="handleNewGame"
      @same-seed="handleSameSeed"
      @exit="exitGame"
      @copy-link="copyLink"
      @cancel="cancelRestart"
    />

    <LightingPanel @apply-tuning="applyDebugTuning" />

    <SettingsPanel :open="settingsOpen" @close="closeSettings" />

    <TutorialOverlay v-if="tutorialOpen" @done="finishTutorial" />

    <Toast :message="toastMessage" :visible="toastVisible" />
  </div>
</template>

<style scoped>
.game-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(1200px 700px at 50% 20%, #12382e 0%, #07120f 58%, #040b09 100%);
}

.game-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.game-stage :deep(.board-canvas) {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.game-stage :deep(.board-canvas:focus-visible) {
  outline: 2px solid rgba(217, 179, 108, 0.85);
  outline-offset: -4px;
}

.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 45%, transparent 58%, rgba(0, 0, 0, 0.16) 100%);
}
</style>
