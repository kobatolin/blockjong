import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/tokens.css'
import './styles/fonts.css'
import './styles/base.css'
import './styles/ui.css'

async function boot(): Promise<void> {
  // The face textures are baked synchronously on the first game start. Wait for
  // both OFL subsets so 東/發/萬 never fall back to a system font.
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.allSettled([
      document.fonts.load('64px MahjongBrush'),
      document.fonts.load('64px MahjongTraditional'),
    ])
  }
  createApp(App).use(createPinia()).mount('#app')
}

void boot()
