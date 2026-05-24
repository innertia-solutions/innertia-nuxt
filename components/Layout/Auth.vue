<template>
  <div class="bg-muted">
    <div class="absolute top-4 right-4 z-20">
      <slot name="theme-switch" />
    </div>
    <main class="flex min-h-full">
      <!-- Columna izquierda: imagen/bienvenida -->
      <div class="relative hidden min-h-screen lg:w-200 xl:w-[65%] bg-surface lg:flex flex-col justify-between p-6 overflow-hidden">
        <slot name="background" />
        <div class="z-0 p-20 pt-[max(180px,10vh)]">
          <slot name="welcome" />
        </div>
      </div>

      <!-- Columna derecha: formulario -->
      <div class="grow px-12 z-10 -ml-6 pr-6 bg-card rounded-tl-[1.5rem] rounded-bl-[1.5rem]">
        <div class="h-full min-h-screen sm:w-112 flex flex-col justify-center mx-auto space-y-5 p-4">
          <div class="flex justify-center mb-6">
            <slot name="logo" />
          </div>
          <slot />
          <div class="absolute bottom-4 right-4 text-xs text-muted-foreground">
            <slot name="version" />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
