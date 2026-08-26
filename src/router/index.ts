import { createRouter, createWebHashHistory } from 'vue-router'

// Hash routing: GitHub Pages has no server-side rewrite, and the 404.html trick
// costs a redirect round trip. See docs/decisions.md > ADR-004.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/FoldersView.vue') },
    {
      path: '/folders/:folderId',
      name: 'folder',
      component: () => import('@/views/FolderView.vue'),
    },
    { path: '/decks/:deckId', name: 'deck', component: () => import('@/views/DeckView.vue') },
    {
      path: '/decks/:deckId/cards/new',
      name: 'card-new',
      component: () => import('@/views/CardEditView.vue'),
    },
    {
      path: '/cards/:cardId/edit',
      name: 'card-edit',
      component: () => import('@/views/CardEditView.vue'),
    },
    {
      path: '/quiz/configure',
      name: 'quiz-configure',
      component: () => import('@/views/QuizConfigureView.vue'),
    },
    { path: '/quiz/run', name: 'quiz-run', component: () => import('@/views/QuizRunView.vue') },
    {
      path: '/quiz/summary',
      name: 'quiz-summary',
      component: () => import('@/views/QuizSummaryView.vue'),
    },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
