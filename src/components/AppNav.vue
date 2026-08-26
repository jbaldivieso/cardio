<template>
  <nav class="navbar is-primary" role="navigation" aria-label="main navigation">
    <div class="navbar-brand">
      <RouterLink
        class="navbar-item has-text-weight-bold"
        :to="{ name: 'home' }"
        data-testid="brand"
      >
        Cardio
      </RouterLink>
    </div>
    <div class="navbar-menu is-active">
      <div class="navbar-end">
        <RouterLink class="navbar-item" :to="{ name: 'settings' }" data-testid="nav-settings">
          Settings
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
