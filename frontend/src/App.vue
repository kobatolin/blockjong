<script setup lang="ts">
import GameCanvas from './components/GameCanvas.vue'
</script>

<template>
  <main class="m1-shell">
    <GameCanvas />
    <div class="vignette" aria-hidden="true"></div>

    <header class="m1-header">
      <p class="eyebrow">MAHJONG SLIDE · M1</p>
      <h1>麻将消消乐</h1>
      <p class="sub">墨绿毛毡与第一张 3D 牌</p>
    </header>

    <footer class="m1-footer">
      <span class="dot"></span>
      Three.js WebGL2 场景已启动
    </footer>
  </main>
</template>

<style scoped>
.m1-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(1200px 700px at 50% 20%, #12382e 0%, #07120f 58%, #040b09 100%);
}

.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 45%, transparent 42%, rgba(0, 0, 0, 0.52) 100%);
}

.m1-header {
  position: absolute;
  top: clamp(24px, 5vh, 56px);
  left: clamp(24px, 5vw, 72px);
  pointer-events: none;
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--gold);
  font-size: 11px;
  letter-spacing: 0.32em;
}

h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(34px, 5vw, 62px);
  font-weight: 600;
  letter-spacing: 0.16em;
  text-shadow: 0 6px 30px rgba(0, 0, 0, 0.45);
}

.sub {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 13px;
  letter-spacing: 0.08em;
}

.m1-footer {
  position: absolute;
  bottom: clamp(20px, 4vh, 42px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 18px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(7, 18, 15, 0.55);
  backdrop-filter: blur(10px);
  color: var(--ivory-dim);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #5fd39a;
  box-shadow: 0 0 12px rgba(95, 211, 154, 0.8);
}
</style>
