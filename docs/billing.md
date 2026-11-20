# Facturación (Billing) — componentes

Front de `Innertia\Billing` (innertia-laravel): planes, suscripción por espacio, consumo medido,
cierre mensual, facturas (por espacio o consolidadas por cliente), pagos, mora y suspensión, y la
cobranza (etapa 3): ajustes y notas de crédito, interés por mora, refacturación con bitácora,
conciliación de cartolas, saldo a favor, estado de cuenta, recordatorios y reportes.
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
| Detalle del cliente (pestaña Ajustes) | `<Billing.Adjustments :client-id="client.id" :spaces="[{ value: key, label: name }]" />` | `spaceKey` (en el detalle del espacio), `canEdit` |
| Detalle del cliente (pestaña Estado de cuenta) | `<Billing.AccountStatement :client-id="client.id" />` | `spaceKey`, `canEdit` |
| Detalle del cliente (pestaña Cobranza) | `<Billing.ClientTerms :client-id="client.id" />` | `canEdit` |
| Detalle del cliente (pestaña Bitácora) | `<Billing.ActivityLog :client-id="client.id" :users="{ id: nombre }" />` | |
| `/platform/billing/reconciliation` | `<Billing.Reconciliation :can-edit="isOwner" />` | `canEdit` |
| `/platform/billing/reports` | `<Billing.Reports />` | `initial` (revenue, receivables, aging, collections, mrr, usage) |
| Cualquier lugar | `<Billing.CreditNoteForm v-model="open" :client-id="id" :invoice="factura?" :spaces="…" @created="…" />` | modal |

- **Invoices**: filtros por estado y cliente, detalle con los cobros por espacio y sus líneas, bitácora,
  **Emitir** (folio SII opcional, envío por correo con el PDF), **Reenviar**, **PDF** y **Registrar pago**
  (transferencia; el excedente queda como saldo a favor del cliente).
- **SpaceSubscription**: iniciar suscripción (plan, modo de pago `invoice`/`automatic`, inicio, días de
  prueba, precio base y por usuario negociados), editar (el cambio de plan rige desde el próximo período),
  suspender, reactivar y cancelar; consumo del período con total estimado y los cobros cerrados.
  Los espacios de pruebas muestran un aviso (nunca se cobran).
- **Invoices** (cobranza): en el detalle, **Anular** (motivo; lo pagado queda a favor), **Refacturar**
  (anula y emite otra: corrige datos de facturación, agrega líneas de corrección netas con signo, nuevo
  vencimiento opcional; los pagos pasan a la nueva), **Nota de crédito** y **Condonar interés**. Muestra
  notas de crédito, tramos de interés por mora y la bitácora con motivo y diferencias.
- **Settings**: tipo de cambio USD→CLP (valoriza la IA), datos para transferencia y emisor del PDF,
  recordatorios de pago (días antes, día del vencimiento, cada N días vencida, máximo, escalamiento con
  correo de cobranza); botones para ejecutar a mano el cierre, la mora y los recordatorios.
- **Adjustments**: descuentos, recargos, cargos únicos y créditos por espacio (monto neto o %; recurrentes
  con vigencia o de una vez) o del cliente completo (solo %); motivo obligatorio; anular pendientes;
  notas de crédito (botón que abre `CreditNoteForm`).
- **CreditNoteForm**: destino factura abierta (con IVA), saldo a favor o próximo cobro del espacio (neto).
- **ClientTerms**: interés por mora (%, base mensual o diaria, tope, exención) y recordatorios del cliente.
- **AccountStatement**: cargos, abonos y saldo corrido con rango de fechas (saldo inicial), saldo a favor
  (botón **Aplicar saldo a favor**), antigüedad de la deuda (por vencer, 0–30, 31–60, 61–90, +90) y Excel.
- **Reconciliation**: **Importar cartola** (CSV o XLSX; vista previa, fila de encabezados y mapeo de
  columnas sugerido o el último usado), la importación corre en cola y concilia sola lo claro; la tabla
  muestra sugerencias con puntaje y razones (**Aplicar**), **Emparejar** a mano (cliente + facturas en
  orden, con vista de lo que se aplica y el saldo a favor que queda), **Deshacer**, **Descartar**/**Restaurar**
  y **Revisar de nuevo**. Importar la misma cartola no duplica.
- **Reports**: ingresos, cuentas por cobrar, antigüedad, recaudación, MRR y consumo; rango, agrupación y Excel.
- **ActivityLog**: bitácora de cobranza del cliente (quién, qué, motivo, monto).

## 3. Backoffice

```vue
<!-- pages/backoffice/billing.vue (permiso billing.view; solo espacios de producción) -->
<Billing.Overview />

<!-- layout del backoffice: franja global de mora / solo lectura -->
<Billing.StatusBanner billing-route="/backoffice/billing" />
```

- **Overview**: plan y estado, total estimado del período, saldo pendiente y vencido, consumo por
  medidor frente a lo incluido (barra de progreso), facturas con PDF y botón **Pagar** cuando hay enlace,
  la parte del espacio en facturas consolidadas, pagos y el **estado de cuenta** del espacio
  (`<Billing.AccountStatement mode="space" />`, se apaga con `:show-account="false"`). Espacio de
  pruebas: solo la franja "Espacio de pruebas".
- **StatusBanner**: se muestra con `past_due` ("Tienes facturas vencidas") o `suspended` ("Espacio en
  solo lectura"). Pásale `status` (por ejemplo desde el header `X-Billing-Status` que pone el
  middleware `billing.enforce`) o deja que consulte `billing/overview` (requiere `billing.view`; si
  falla no muestra nada). `:fetch="false"` evita la consulta.
- Una escritura con el espacio suspendido responde **402** `{code: 'subscription_suspended'}`.

## 4. Composables

- `useBillingPlatform({ base })` → `plans`, `meters`, `savePlan`, `invoices(filtersRef)`, `invoice(id)`,
  `issue`, `resend`, `registerPayment`, `space(keyRef)`, `startSubscription`, `updateSubscription`,
  `subscriptionAction`, `clientTotals`, `settings`, `saveSettings`, `run` (`close|dunning|reminders`) y de
  cobranza `adjustments(filtersRef)`, `createAdjustment`, `cancelAdjustment`, `createCreditNote`,
  `terms(clientIdRef)`, `saveTerms`, `applyCredit`, `account(clientIdRef, paramsRef)`, `activity(filtersRef)`,
  `voidInvoice`, `reissue`, `waiveLateFees`, `preview(file, headerRow?)`, `importStatement`, `imports`
  (se refresca solo mientras hay importaciones en curso), `transactions(filtersRef)`, `openInvoices(params)`,
  `match`, `unmatch`, `ignore`, `restore`, `rematch`, `report(nameRef, paramsRef)`.
- `useBillingSpace({ base })` → `overview`, `invoices`, `payments`, `account(paramsRef)` (backoffice).
- `useBillingPdf()` → `(path, filename) => Promise` descarga un PDF con la sesión.
- `useBillingDownload()` → `(path, filename, params?) => Promise` descarga un Excel (reportes, estado de cuenta).
- Helpers puros (formato de pesos, estados, períodos, progreso de consumo) en
  `composables/useBilling/internal/billing.ts`.
