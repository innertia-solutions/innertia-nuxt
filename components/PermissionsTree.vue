<script setup>
import { IconSearch, IconFolder, IconFolderOpen, IconKey, IconStack2 } from '@tabler/icons-vue'

const props = defineProps({
  apps:        { type: Array, default: () => [] },   // [{ app, app_label, groups: [{ category, category_alias, permissions }] }]
  modelValue:  { type: Array, default: () => [] },   // selected permission names
  readonly:    { type: Boolean, default: false },
  folderColor: { type: String, default: 'gray' },
})

const emit = defineEmits(['update:modelValue'])

const folderColorClass = computed(() => ({
  gray:   'text-slate-400 dark:text-slate-500',
  blue:   'text-blue-400 dark:text-blue-500',
  amber:  'text-amber-400 dark:text-amber-500',
  green:  'text-green-400 dark:text-green-500',
  purple: 'text-purple-400 dark:text-purple-500',
  rose:   'text-rose-400 dark:text-rose-500',
}[props.folderColor] ?? 'text-slate-400 dark:text-slate-500'))

const search = ref('')

// Flatten all permissions for search
const filteredApps = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.apps

  return props.apps
    .map(app => ({
      ...app,
      groups: app.groups
        .map(g => ({
          ...g,
          permissions: g.permissions.filter(p =>
            p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
          ),
        }))
        .filter(g => g.permissions.length > 0),
    }))
    .filter(app => app.groups.length > 0)
})

const visibleApps = computed(() => {
  if (!props.readonly) return filteredApps.value
  return filteredApps.value
    .map(app => ({
      ...app,
      groups: app.groups
        .map(g => ({
          ...g,
          permissions: g.permissions.filter(p => props.modelValue.includes(p.name)),
        }))
        .filter(g => g.permissions.length > 0),
    }))
    .filter(app => app.groups.length > 0)
})

// Collapse state — keyed as "app" or "app::category"
const collapsed = ref({})

watch(search, (q) => {
  if (!q.trim()) return
  filteredApps.value.forEach(app => {
    collapsed.value[app.app] = false
    app.groups.forEach(g => { collapsed.value[`${app.app}::${g.category}`] = false })
  })
})

function isCollapsed(key) { return collapsed.value[key] ?? false }
function toggle(key) { collapsed.value[key] = !collapsed.value[key] }

function isSelected(name) { return props.modelValue.includes(name) }

function appPermNames(app) {
  return app.groups.flatMap(g => g.permissions.map(p => p.name))
}

function groupPermNames(group) {
  return group.permissions.map(p => p.name)
}

function appState(app) {
  const names = appPermNames(app)
  const n = names.filter(n => props.modelValue.includes(n)).length
  return n === 0 ? 'none' : n === names.length ? 'all' : 'partial'
}

function groupState(group) {
  const names = groupPermNames(group)
  const n = names.filter(n => props.modelValue.includes(n)).length
  return n === 0 ? 'none' : n === names.length ? 'all' : 'partial'
}

function toggleApp(app) {
  const names = appPermNames(app)
  const next = appState(app) === 'all'
    ? props.modelValue.filter(n => !names.includes(n))
    : [...new Set([...props.modelValue, ...names])]
  emit('update:modelValue', next)
}

function toggleGroup(group) {
  const names = groupPermNames(group)
  const next = groupState(group) === 'all'
    ? props.modelValue.filter(n => !names.includes(n))
    : [...new Set([...props.modelValue, ...names])]
  emit('update:modelValue', next)
}

function togglePermission(name) {
  const next = isSelected(name)
    ? props.modelValue.filter(n => n !== name)
    : [...props.modelValue, name]
  emit('update:modelValue', next)
}

function setIndeterminate(el, state) {
  if (el) el.indeterminate = state === 'partial'
}

function appSelectedCount(app) {
  return appPermNames(app).filter(n => props.modelValue.includes(n)).length
}
function appTotalCount(app) { return appPermNames(app).length }
function groupSelectedCount(group) {
  return groupPermNames(group).filter(n => props.modelValue.includes(n)).length
}
</script>

<template>
  <div class="w-full space-y-2">

    <!-- Search -->
    <div class="relative">
      <IconSearch class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
      <input
        v-model="search"
        type="search"
        placeholder="Buscar permiso…"
        class="w-full pl-7 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-400"
      />
    </div>

    <!-- Tree -->
    <div class="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden text-sm">

      <div v-if="visibleApps.length === 0" class="px-3 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
        {{ search ? 'Sin resultados.' : readonly ? 'Sin permisos asignados.' : 'Sin permisos disponibles.' }}
      </div>

      <template v-for="(app, ai) in visibleApps" :key="app.app">

        <!-- ── App row (level 1) ── -->
        <div
          class="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer select-none bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
          :class="ai > 0 ? 'border-t border-slate-200 dark:border-slate-700' : ''"
          @click="toggle(app.app)"
        >
          <input
            v-if="!readonly"
            type="checkbox"
            class="size-3 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
            :checked="appState(app) === 'all'"
            :ref="el => setIndeterminate(el, appState(app))"
            @click.stop
            @change="toggleApp(app)"
          />
          <IconStack2 class="size-3.5 shrink-0" :class="folderColorClass" />
          <span class="font-bold text-slate-700 dark:text-slate-200 flex-1 truncate tracking-wide uppercase text-[11px]">
            {{ app.app_label || app.app }}
          </span>
          <span class="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
            {{ readonly
              ? appTotalCount(app)
              : `${appSelectedCount(app)}/${appTotalCount(app)}`
            }}
          </span>
        </div>

        <template v-if="!isCollapsed(app.app)">
          <template v-for="(group, gi) in app.groups" :key="group.category">

            <!-- ── Category row (level 2) ── -->
            <div
              class="flex items-center gap-1 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer select-none"
              @click="toggle(`${app.app}::${group.category}`)"
            >
              <!-- indent line -->
              <div class="flex items-center shrink-0 pl-3" style="width:32px">
                <div class="flex flex-col items-center h-full" style="width:10px">
                  <div class="w-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <div class="w-2.5 h-px bg-slate-200 dark:bg-slate-700" />
                  <div class="w-px flex-1 bg-slate-200 dark:bg-slate-700"
                    :class="gi === app.groups.length - 1 ? 'opacity-0' : ''" />
                </div>
              </div>

              <input
                v-if="!readonly"
                type="checkbox"
                class="size-3 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
                :checked="groupState(group) === 'all'"
                :ref="el => setIndeterminate(el, groupState(group))"
                @click.stop
                @change="toggleGroup(group)"
              />
              <IconFolderOpen v-if="!isCollapsed(`${app.app}::${group.category}`)" class="size-3.5 shrink-0" :class="folderColorClass" />
              <IconFolder     v-else                                                class="size-3.5 shrink-0" :class="folderColorClass" />

              <span class="font-semibold text-slate-600 dark:text-slate-300 flex-1 truncate py-1">
                {{ group.category_alias ?? group.category }}
              </span>
              <span class="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 pr-2 shrink-0">
                {{ readonly
                  ? group.permissions.length
                  : `${groupSelectedCount(group)}/${group.permissions.length}`
                }}
              </span>
            </div>

            <!-- ── Permission rows (level 3) ── -->
            <template v-if="!isCollapsed(`${app.app}::${group.category}`)">
              <div
                v-for="(perm, pi) in group.permissions"
                :key="perm.name"
                class="flex items-center gap-1 border-t border-slate-100 dark:border-slate-800 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-colors"
                :class="!readonly ? 'cursor-pointer' : ''"
                @click="!readonly && togglePermission(perm.name)"
              >
                <!-- double indent line -->
                <div class="flex items-center shrink-0 pl-3" style="width:52px">
                  <div class="flex flex-col items-center h-full mr-1" style="width:10px">
                    <div class="w-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    <div class="w-px flex-1 bg-slate-200 dark:bg-slate-700"
                      :class="gi === app.groups.length - 1 ? 'opacity-0' : ''" />
                  </div>
                  <div class="flex flex-col items-center h-full" style="width:10px">
                    <div class="w-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    <div class="w-2.5 h-px bg-slate-200 dark:bg-slate-700" />
                    <div class="w-px flex-1 bg-slate-200 dark:bg-slate-700"
                      :class="pi === group.permissions.length - 1 ? 'opacity-0' : ''" />
                  </div>
                </div>

                <div class="shrink-0 flex items-center justify-center w-3.5">
                  <input
                    v-if="!readonly"
                    type="checkbox"
                    class="size-3 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 cursor-pointer"
                    :checked="isSelected(perm.name)"
                    @click.stop
                    @change="togglePermission(perm.name)"
                  />
                  <span v-else class="size-1.5 rounded-full bg-green-500 block" />
                </div>

                <IconKey class="size-3 text-slate-400 dark:text-slate-500 shrink-0" />
                <span class="font-mono text-slate-700 dark:text-slate-300 truncate flex-1 py-1">{{ perm.name }}</span>
                <span class="text-slate-400 dark:text-slate-500 truncate hidden sm:block pr-2" style="max-width:240px">
                  {{ perm.description ?? '' }}
                </span>
              </div>
            </template>

          </template>
        </template>

      </template>
    </div>
  </div>
</template>
