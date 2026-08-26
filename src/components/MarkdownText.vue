<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/domain/markdown'

/**
 * The only `v-html` in the app (spec §8, CLAUDE.md > Architecture). It is safe
 * because `renderMarkdown` runs markdown-it with `html: false`, so anything
 * that looks like a tag in a card face has already been escaped to text.
 */
const props = defineProps<{ source: string }>()

const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- the one sanctioned v-html; see above -->
  <div class="content" v-html="html" />
</template>
