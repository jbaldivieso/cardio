import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useInstallStore } from './stores/install'
import './styles/main.scss'

const pinia = createPinia()
const app = createApp(App).use(pinia).use(router)

// `beforeinstallprompt` fires once, moments after load, long before anyone opens
// the settings screen that shows the hint (§7.8). Only a store that exists from
// boot is still listening when it arrives.
useInstallStore(pinia)

// Nothing is seeded: every folder is one the user made (ADR-050), so the app has
// nothing to write before its first paint.
app.mount('#app')
