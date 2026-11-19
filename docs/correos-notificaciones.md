# Correos y notificaciones con marca

Front del motor de avisos y correos de innertia-laravel (`\Innertia\Notifications`, `\Innertia\Mail`).
Guía del backend: `docs/correos-notificaciones.md` de innertia-laravel (rutas, `NoticeTypes`, `Notifier`).

**Todo es opt-in:** ningún componente se monta solo y el middleware de cambio de clave forzado
no hace nada hasta activarlo. Los productos que tienen sus propias páginas siguen igual.

## Campanita en platform

El producto registra en su grupo platform `\Innertia\Notifications\Routes::register('notifications')`
(queda en `platform/notifications`) y monta la campanita en el layout de platform:

```vue
<App.NotificationBell endpoint="platform/notifications" all-route="/platform/notifications" />
```

```vue
<!-- pages/platform/notifications.vue -->
<template><App.NotificationHistory endpoint="platform/notifications" /></template>
```

`useNotifications({ base })` y `useNotificationHistory({ base })` aceptan el mismo prefijo
(default `notifications`, el backoffice no cambia).

## Preferencias (Mi cuenta › Notificaciones)

```vue
<Notifications.Preferences />                                                   <!-- backoffice -->
<Notifications.Preferences endpoint="platform/me/notification-preferences" />  <!-- platform -->
```

Lista los tipos registrados en `NoticeTypes` con un interruptor por canal (campanita/correo).
Los avisos críticos de cuenta se muestran con candado y deshabilitados (el servidor ignora
apagarlos). Solo envía lo cambiado. Composable: `useNotificationPreferences({ base })`.

## Registro de correos (/platform/emails)

```vue
<!-- pages/platform/emails/index.vue -->
<script setup>definePageMeta({ layout: 'platform', middleware: 'platform' })</script>
<template><Platform.Emails :tenants="tenantOptions" /></template>
```

Filtros por destinatario/asunto, estado, tipo (de `emails/types`) y espacio (`tenants`, opcional).
Los fallidos se expanden para ver el motivo.

## Configuración de correo (/platform/settings/mail, solo owner)

```vue
<script setup>definePageMeta({ layout: 'platform', middleware: ['platform', 'platform-owner'] })</script>
<template>
  <Platform.MailSettings>
    <!-- opcional: selector de imagen del producto -->
    <template #logo-picker="{ set }"><Platform.FileImagePicker @picked="set" /></template>
  </Platform.MailSettings>
</template>
```

Proveedor (Mailpit/SMTP, Resend), API key encriptada (confirmación al borrar), remitente, logo y
color con validación por campo, aviso de cambios sin guardar, correo de prueba con la
configuración guardada y vista previa en vivo + del correo enviado. El middleware
`platform-owner` de la capa redirige a `/platform` a quien no es owner (si el producto tiene uno
propio con ese nombre, gana el del producto).

## Marca del espacio (Sistema › Marca)

```vue
<script setup>definePageMeta({ middleware: ['auth'] })</script>
<template>
  <Mail.BrandingSettings>
    <template #logo-picker="{ set }"><MiSelectorDeDocumentos @picked="(f) => set({ logo_file_id: f.id })" /></template>
  </Mail.BrandingSettings>
</template>
```

Backend: `\Innertia\Mail\Routes::tenantBranding('settings/branding')` con el permiso del producto
(p. ej. `settings.manage`). Nombre visible, logo (URL pública o archivo de Documentos), color y pie
(dirección/teléfono), vista previa en vivo y "Enviarme un correo de prueba".

`<Mail.BrandingPreview :branding="campos" :platform="marcaPlataforma" />` sirve suelto: resuelve
igual que `Branding::for()` del backend (respaldo campo a campo y "Enviado vía …").

## Cambio de contraseña forzado

```ts
// nuxt.config.ts del producto
appConfig: {
  innertia: {
    forcePassword: {
      enabled: true,
      routes: { '/backoffice': '/backoffice/auth/change-password' },  // prefijo → página de cambio
      // allow: ['/backoffice/auth/'],                                // por defecto '<prefijo>/auth/'
    },
  },
}
```

Con `user.force_password_change === true`, cualquier ruta del área lleva a su página de cambio.
`/platform` ya lo cubre `05.platform-password.global`. Si el producto tiene su propio
`force-password.global.ts`, bórralo al activar este.
