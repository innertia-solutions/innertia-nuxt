# Passkeys (WebAuthn)

Ingreso con huella, rostro o llave de seguridad sobre `\Innertia\Passkeys` de innertia-laravel. Hay componentes para el login, la invitación a registrar, la gestión propia y la administración por usuario, más el composable `usePasskeys()`.

## Requisitos (backend Laravel)

1. `php artisan migrate` (crea la tabla de passkeys y la de configuración).
2. **Activación:** el ingreso con passkey viene **encendido por defecto** y se controla desde la consola `/platform` con `<Auth.PasskeySettings />` (interruptores "Ingreso con passkey" y "Permitir subdominios"; se guardan en BD). No hay variables de entorno. El producto registra las rutas en su grupo platform: `\Innertia\Passkeys\Routes::platformSettings('')`.
3. El front consulta `GET auth/passkey/status` (o `platform/auth/passkey/status`, con `usePasskeys({ platform: true })`) y solo ofrece la función si responde `{ enabled: true }`; el resultado se cachea por página y un fallo cuenta como desactivado. Con el interruptor apagado el backend responde 404 en login y autogestión, pero `users/{id}/passkeys` (administración) sigue funcionando para revocar.
4. El dominio (`rp_id`) y los orígenes se derivan de la URL del front; `<Auth.PasskeySettings />` los muestra en solo lectura.
5. El cache store de Laravel debe ser **compartido** entre instancias (Redis); las opciones de la ceremonia se guardan ahí.

```vue
<!-- pages/platform/settings/passkeys.vue -->
<template><Auth.PasskeySettings /></template>
```

Notas:

- Las cuentas de plataforma con cambio de contraseña forzado pendiente no pueden registrar una passkey hasta cambiarla.
- El BFF (`/_auth/passkey/login`, `/_auth/platform/passkey/login`) sella la sesión httpOnly **solo si Laravel devuelve token**. Los pasos previos (cambio forzado, verificación de correo) no traen token y llegan al componente como `pending`. El token nunca llega al navegador.

## Login de tenant

`<Auth.PasskeyButton>` arranca la ceremonia y, con `autofill` (por defecto), también el autocompletado del navegador.

- **Autocompletado:** necesita un input con `autocomplete="username webauthn"` (con `webauthn` al final) presente al montar el botón; si no existe, el autocompletado simplemente no arranca. `<Auth.LoginForm>` de la librería ya lo trae. El autocompletado se renueva solo cada ~270 s (el reto dura 300 s), se detiene al pulsar el botón y al desmontar, y no se reanuda tras un ingreso exitoso. Sus errores previos a que el usuario elija una passkey no se muestran (solo `console.debug` en dev).
- **`contexts` es obligatorio** en el login de tenant (el backend exige al menos uno). Sin `contexts` y sin `platform`, el composable lanza `Error('PasskeyButton requiere contexts')` antes de cualquier ceremonia y avisa por consola en dev.

```vue
<template>
  <form @submit.prevent="onSubmit">
    <input v-model="email" type="email" autocomplete="username webauthn" />
    <input v-model="password" type="password" autocomplete="current-password" />
    <button type="submit">Ingresar</button>

    <Auth.PasskeyButton
      :contexts="['backoffice']"
      @success="onPasskeySuccess"
      @pending="onPasskeyPending"
    />
  </form>
</template>
```

- `@success(data)`: ingreso completo. `data.context` indica el contexto (y `data.tenantDestination` en modo `open`). Navega igual que tras `performLogin` (`finishLogin` ya dejó la sesión lista).
- `@pending(data)`: hay un paso previo, p. ej. cambio forzado de contraseña; reutiliza el mismo flujo que el login con contraseña.
- `@error(message, originalError)`: mensaje legible para mostrar y el error original (p. ej. para detectar un 409 `platform_account`: `originalError?.status === 409`). Las cancelaciones del usuario (cerrar el diálogo del navegador, `NotAllowedError`, aborts) no emiten nada.

Props: `contexts` (array), `platform` (bool), `autofill` (bool, `true`), `label` (texto del botón).

## Login de plataforma

En `/platform/login`, con la prop `platform` (identidad separada, sin contexto de tenant):

```vue
<Auth.PasskeyButton platform @success="navigateTo('/platform')" />
```

El ingreso de plataforma siempre devuelve token (no hay `pending`). Si la cuenta tiene un cambio de contraseña forzado pendiente, el ingreso funciona pero las llamadas siguientes responden `403 password_change_required`: en ese caso redirige a la pantalla de cambio de contraseña.

## Invitación tras ingresar con contraseña

`<Auth.PasskeyInvite />` muestra un aviso discreto "Ingresa con tu huella la próxima vez", una sola vez por usuario y dispositivo. No aparece si el navegador no soporta WebAuthn, si ya hay passkeys, si se descartó o si el ingreso fue con passkey. Colócalo en el layout autenticado:

```vue
<!-- layouts/backoffice.vue -->
<Auth.PasskeyInvite />

<!-- layouts/platform.vue -->
<Auth.PasskeyInvite base="platform/auth" />
```

## Gestión propia (perfil)

`<Auth.PasskeyManager>` lista, agrega, renombra y elimina las passkeys del usuario autenticado. `base` es `auth` (tenant, por defecto) o `platform/auth` (cuenta de plataforma).

```vue
<Auth.PasskeyManager base="auth" />
```

## Administración por usuario

`<Auth.UserPasskeys>` muestra las passkeys de otro usuario y permite revocarlas todas. Úsalo en la ficha de usuario **solo para administradores**.

```vue
<Auth.UserPasskeys v-if="isAdmin" :user-id="user.id" />
```

## Composable `usePasskeys()`

| Método | Uso |
|--------|-----|
| `usePasskeys({ platform })` | `platform: true` usa el estado de `platform/auth/passkey/status`; por defecto el de tenant (`auth/passkey/status`) |
| `supported`, `autofillSupported`, `enabled`, `available`, `ready` | refs; `false` en SSR y en el primer render, se resuelven en `onMounted` (`ready` indica que ya se resolvió). `enabled` = interruptor de plataforma; `available` = `supported && enabled` |
| `ensureEnabled()`, `refreshStatus()` | lee el interruptor (con caché) / descarta la caché y lo relee (tras guardar en `/platform`) |
| `login({ contexts })`, `loginPlatform()` | ceremonia de ingreso (tenant / plataforma) |
| `startAutofill({ contexts, platform })`, `stopAutofill()`, `dispose()` | autocompletado (conditional UI); se libera solo al desmontar el componente que llamó a `usePasskeys()` |
| `list(base)`, `register(name?, base)`, `rename(id, name, base)`, `remove(id, base)` | gestión propia |
| `listForUser(userId)`, `revokeAll(userId)` | administración |
| `loggedInWithPasskey()`, `markPasskeyLogin(on)` | marca de sesión (oculta la invitación) |
| `errorMessage(err)`, `isCancel(err)`, `isDismissed(err)` | mensajes legibles; `isCancel` = aborts; `isDismissed` = aborts + `NotAllowedError` (botón de ingreso) |

Llama a `usePasskeys()` durante el `setup` de un componente.
