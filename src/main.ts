import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { seedDefaults } from './db'
import { router } from './router'
import { useInstallStore } from './stores/install'
import './styles/main.scss'

const pinia = createPinia()
const app = createApp(App).use(pinia).use(router)

// `beforeinstallprompt` fires once, moments after load, long before anyone opens
// the settings screen that shows the hint (§7.8). Only a store that exists from
// boot is still listening when it arrives.
useInstallStore(pinia)

// The Unsorted folder has to exist before anything lists folders (spec §4.2), so
// seeding happens before the first paint. A browser that refuses IndexedDB still
// gets the app: the stores surface the failure where the user can see it.
seedDefaults()
  .catch(() => undefined)
  .finally(() => app.mount('#app'))
