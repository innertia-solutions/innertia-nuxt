# Facturación (Billing) — componentes

Front de `Innertia\Billing` (innertia-laravel): planes, suscripción por espacio, consumo medido,
cierre mensual, facturas (por espacio o consolidadas por cliente), pagos, mora y suspensión.
La lógica vive en el backend; estos componentes solo muestran y llaman a sus endpoints.

Montos: enteros en pesos (CLP sin decimales). Fechas de período: fechas locales de Chile
(`YYYY-MM-DD`, ambos extremos incluidos).

## 1. Backend que hay que montar (en el producto)

```php
// Grupo platform (prefijo 'platform')
\Innertia\Billing\Routes::platform();                                      // lectura (owner y staff)
Route::middleware('platform.owner')->group(fn () => \Innertia\Billing\Routes::platformWrite());

// Grupo backoffice (espacio activo), solo lectura
Route::middleware('permission:billing.view')->group(fn () => \Innertia\Billing\Routes::backoffice());

// Escrituras del backoffice en solo lectura cuando el espacio está suspendido
Route::middleware('billing.enforce')->group(/* rutas del backoffice */);
```

Activar el feature en el backend: ver `docs/billing.md` de innertia-laravel.

## 2. Platform

| Página sugerida | Componente | Props |
|---|---|---|
| `/platform/billing` (resumen) | `<Billing.ClientTotals @select-space="…" @select-client="…" />` | `endpoint` (default `platform/billing`) |
| `/platform/billing/invoices` | `<Billing.Invoices :clients="opciones" />` | `clientId`, `spaceKey`, `clients`, `canEdit` |
| `/platform/billing/plans` | `<Billing.Plans :can-edit="isOwner" />` | `canEdit` |
| `/platform/billing/settings` | `<Billing.Settings />` (solo owner) | `canRun` |
| Detalle del espacio (pestaña Suscripción) | `<Billing.SpaceSubscription :space-key="key" :can-edit="isOwner" />` | `spaceKey` (obligatoria) |
| Detalle del cliente (pestaña Facturas) | `<Billing.Invoices :client-id="client.id" />` | |

- **Invoices**: filtros por estado y cliente, detalle con los cobros por espacio y sus líneas, bitácora,
  **Emitir** (folio SII opcional, envío por correo con el PDF), **Reenviar**, **PDF** y **Registrar pago**
  (transferencia; el excedente queda como saldo a favor del cliente).
- **SpaceSubscription**: iniciar suscripción (plan, modo de pago `invoice`/`automatic`, inicio, días de
  prueba, precio base y por usuario negociados), editar (el cambio de plan rige desde el próximo período),
  suspender, reactivar y cancelar; consumo del período con total estimado y los cobros cerrados.
  Los espacios de pruebas muestran un aviso (nunca se cobran).
- **Settings**: tipo de cambio USD→CLP (valoriza la IA), datos para transferencia y emisor del PDF;
  botones para ejecutar a mano el cierre y la revisión de mora (también corren solos cada día).

## 3. Backoffice

```vue
<!-- pages/backoffice/billing.vue (permiso billing.view; solo espacios de producción) -->
<Billing.Overview />

<!-- layout del backoffice: franja global de mora / solo lectura -->
<Billing.StatusBanner billing-route="/backoffice/billing" />
```

- **Overview**: plan y estado, total estimado del período, saldo pendiente y vencido, consumo por
  medidor frente a lo incluido (barra de progreso), facturas con PDF y botón **Pagar** cuando hay enlace,
  la parte del espacio en facturas consolidadas, y pagos. Espacio de pruebas: solo la franja
  "Espacio de pruebas".
- **StatusBanner**: se muestra con `past_due` ("Tienes facturas vencidas") o `suspended` ("Espacio en
  solo lectura"). Pásale `status` (por ejemplo desde el header `X-Billing-Status` que pone el
  middleware `billing.enforce`) o deja que consulte `billing/overview` (requiere `billing.view`; si
  falla no muestra nada). `:fetch="false"` evita la consulta.
- Una escritura con el espacio suspendido responde **402** `{code: 'subscription_suspended'}`.

## 4. Composables

- `useBillingPlatform({ base })` → `plans`, `meters`, `savePlan`, `invoices(filtersRef)`, `invoice(id)`,
  `issue`, `resend`, `registerPayment`, `space(keyRef)`, `startSubscription`, `updateSubscription`,
  `subscriptionAction`, `clientTotals`, `settings`, `saveSettings`, `run`.
- `useBillingSpace({ base })` → `overview`, `invoices`, `payments` (backoffice).
- `useBillingPdf()` → `(path, filename) => Promise` descarga un PDF con la sesión.
- Helpers puros (formato de pesos, estados, períodos, progreso de consumo) en
  `composables/useBilling/internal/billing.ts`.
