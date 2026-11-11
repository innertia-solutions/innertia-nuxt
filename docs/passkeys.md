# Passkeys (WebAuthn)

Ingreso con huella, rostro o llave de seguridad sobre `\Innertia\Passkeys` de innertia-laravel. Hay componentes para el login, la invitación a registrar, la gestión propia y la administración por usuario, más el composable `usePasskeys()`.

## Requisitos (backend Laravel)

1. En el `.env` del producto: `PASSKEYS_ENABLED=true`.
2. `php artisan migrate` (crea la tabla de passkeys).
3. `PASSKEYS_RP_ID` = host del **front** (en dev, `localhost`; en prod, por ejemplo `app.pomely.cl`). Los orígenes permitidos por defecto son la URL del front.
4. Si los tenants viven en subdominios: `PASSKEYS_ALLOW_SUBDOMAINS=true`.
5. El cache store de Laravel debe ser **compartido** entre instancias (Redis); las opciones de la ceremonia se guardan ahí.

Notas:

- Las cuentas de plataforma con cambio de contraseña forzado pendiente no pueden registrar una passkey hasta cambiarla.
- El BFF (`/_auth/passkey/login`, `/_auth/platform/passkey/login`) sella la sesión httpOnly **solo si Laravel devuelve token**. Los pasos previos (cambio forzado, verificación de correo) no traen token y llegan al componente como `pending`. El token nunca llega al navegador.

## Login de tenant

`<Auth.PasskeyButton>` arranca la ceremonia y, con `autofill` (por defecto), también el autocompletado del navegador. Para que el autocompletado funcione, el campo de correo debe llevar `autocomplete="username webauthn"`.

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
- `@error(message)`: mensaje legible para mostrar (las cancelaciones del usuario no emiten error).

Props: `contexts` (array), `platform` (bool), `autofill` (bool, `true`), `label` (texto del botón).

## Login de plataforma

En `/platform/login`, con la prop `platform` (identidad separada, sin contexto de tenant):

```vue
<Auth.PasskeyButton platform @success="navigateTo('/platform')" @pending="onPending" />
```

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
| `supported`, `autofillSupported` | refs con el soporte del navegador |
| `login({ contexts })`, `loginPlatform()` | ceremonia de ingreso (tenant / plataforma) |
| `startAutofill({ contexts, platform })`, `stopAutofill()` | autocompletado (conditional UI) |
| `list(base)`, `register(name?, base)`, `rename(id, name, base)`, `remove(id, base)` | gestión propia |
| `listForUser(userId)`, `revokeAll(userId)` | administración |
| `loggedInWithPasskey()`, `markPasskeyLogin(on)` | marca de sesión (oculta la invitación) |
| `errorMessage(err)`, `isCancel(err)` | mensajes legibles y detección de cancelación |
