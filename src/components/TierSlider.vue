<script setup lang="ts">
import { computed, useId } from 'vue'
import { QUIZ_TIERS, tierLabel } from '@/domain/quiz'
import type { QuizTier } from '@/domain/quiz'

/**
 * The seven-position mastery slider of spec §6.2, labelled at every stop
 * (ADR-028). A native range input carries the semantics and the drag; the
 * arrow keys are handled here rather than left to the browser so that one step
 * means one tier everywhere, including under a DOM that does not implement
 * range stepping. Each handled key cancels the native change, so the two can
 * never both move it.
 */
const props = defineProps<{ modelValue: QuizTier }>()
const emit = defineEmits<{ 'update:modelValue': [tier: QuizTier] }>()

const label = computed(() => tierLabel(props.modelValue))
/** The input and its label are tied by id; nothing else names the control. */
const sliderId = useId()

function moveTo(tier: number): void {
  const target = QUIZ_TIERS.find((known) => known === tier)
  if (target === undefined || target === props.modelValue) return
  emit('update:modelValue', target)
}

function onKeydown(event: KeyboardEvent): void {
  const steps: Record<string, number> = {
    ArrowRight: props.modelValue + 1,
    ArrowUp: props.modelValue + 1,
    ArrowLeft: props.modelValue - 1,
    ArrowDown: props.modelValue - 1,
    Home: QUIZ_TIERS[0],
    End: QUIZ_TIERS[QUIZ_TIERS.length - 1],
  }
  const target = steps[event.key]
  if (target === undefined) return
  event.preventDefault()
  moveTo(target)
}

function onInput(event: Event): void {
  moveTo(Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="field">
    <label class="label is-size-6" :for="sliderId">Mastery mix</label>
    <input
      :id="sliderId"
      class="cardio-tier-slider"
      type="range"
      min="1"
      max="7"
      step="1"
      :value="modelValue"
      :aria-valuetext="label"
      data-testid="tier-slider"
      @input="onInput"
      @keydown="onKeydown"
    />
    <p class="is-size-6 has-text-weight-medium" data-testid="tier-label">{{ label }}</p>
    <p class="has-text-grey">Tier {{ modelValue }} of {{ QUIZ_TIERS.length }}</p>
  </div>
</template>

<style scoped>
/* Spec §7: a slider is a touch target too, and Bulma has no range styling. */
.cardio-tier-slider {
  width: 100%;
  min-height: 44px;

  /* The tier in force — thumb and the track behind it — in the palette's
     chartreuse (ADR-048). `accent-color` is what a native range answers to, so
     the browser keeps its own thumb, its focus ring and its platform sizing. */
  accent-color: var(--cardio-accent);
}
</style>
