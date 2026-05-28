<script setup>
/**
 * <ModalHost /> — Mount-once en el layout root para habilitar useModal().
 *
 * Renderiza la cola de modales programáticos del store. Cada entry sabe
 * dispatchar al componente adecuado según su `kind`.
 */
import { useModalStore } from '../../stores/modal'

const store = useModalStore()

const closeWith = (id, value) => store.resolve(id, value)
</script>

<template>
  <template v-for="entry in store.queue" :key="entry.id">
    <!-- Confirm -->
    <ModalConfirm
      v-if="entry.kind === 'confirm'"
      :model-value="true"
      v-bind="entry.props"
      @confirm="closeWith(entry.id, true)"
      @cancel="closeWith(entry.id, false)"
      @update:model-value="v => !v && closeWith(entry.id, false)"
    />

    <!-- Alert (confirm sin cancel) -->
    <ModalConfirm
      v-else-if="entry.kind === 'alert'"
      :model-value="true"
      hide-cancel
      v-bind="entry.props"
      @confirm="closeWith(entry.id, undefined)"
      @cancel="closeWith(entry.id, undefined)"
      @update:model-value="v => !v && closeWith(entry.id, undefined)"
    />

    <!-- Prompt -->
    <ModalPrompt
      v-else-if="entry.kind === 'prompt'"
      :model-value="true"
      v-bind="entry.props"
      @submit="value => closeWith(entry.id, value)"
      @cancel="closeWith(entry.id, null)"
      @update:model-value="v => !v && closeWith(entry.id, null)"
    />

    <!-- Custom component — recibe modelValue + props + emite close(value) -->
    <component
      v-else-if="entry.kind === 'component' && entry.component"
      :is="entry.component"
      :model-value="true"
      v-bind="entry.props"
      @close="value => closeWith(entry.id, value)"
      @update:model-value="v => !v && closeWith(entry.id, undefined)"
    />
  </template>
</template>
