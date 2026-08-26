import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { seedDefaults } from './db'
import { router } from './router'
import './styles/main.scss'

const app = createApp(App).use(createPinia()).use(router)

// The Unsorted folder has to exist before anything lists folders (spec §4.2), so
// seeding happens before the first paint. A browser that refuses IndexedDB still
// gets the app: the stores surface the failure where the user can see it.
seedDefaults()
  .catch(() => undefined)
  .finally(() => app.mount('#app'))
