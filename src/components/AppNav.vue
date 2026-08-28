<template>
  <nav class="navbar is-primary" role="navigation" aria-label="main navigation">
    <!-- Both items live in the brand rather than in a `navbar-menu`, because
         Bulma drops the menu onto its own row below the burger on mobile and
         this nav has no burger to open it. The brand is the one row Bulma keeps
         horizontal at every width, so the gear stays beside the wordmark. -->
    <div class="navbar-brand">
      <RouterLink
        class="navbar-item has-text-weight-bold"
        :to="{ name: 'home' }"
        data-testid="brand"
      >
        Cardio
      </RouterLink>
      <RouterLink
        class="navbar-item nav-settings"
        :to="{ name: 'settings' }"
        aria-label="Settings"
        title="Settings"
        data-testid="nav-settings"
      >
        <span class="icon">
          <!-- Feather "settings" (feathericons.com), MIT. Inlined rather than
               depended on: one icon, and nothing may reach the network. -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
            />
          </svg>
        </span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
/* Bulma's brand is `flex-shrink: 0` and hugs its content; letting it fill the
   bar is what gives the gear somewhere to be pushed to. */
.navbar-brand {
  flex-grow: 1;
}

.nav-settings {
  margin-left: auto;
}
</style>
