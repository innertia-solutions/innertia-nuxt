# Consumo de IA — componentes

Front del costeo de IA de `Innertia\Ai` (innertia-laravel): precios por modelo en USD y consumo
agregado por función, día y espacio. Cada uso se valoriza al registrarse con el precio vigente del
modelo (no es retroactivo); los usos de modelos sin precio se cuentan como "sin precio".

## 1. Backend que hay que montar (en el producto)

```php
// Grupo platform (prefijo 'platform')
\Innertia\Ai\Routes::platform();                                           // GET ai/models/prices, GET ai/usage/report
Route::middleware('platform.owner')->group(fn () => \Innertia\Ai\Routes::platformWrite());  // PUT ai/models/{id}/prices

// Grupo backoffice (espacio activo)
\Innertia\Ai\Routes::tenant();                                             // GET ai/usage/summary
```

## 2. Componentes

| Dónde | Componente | Props |
|---|---|---|
| `/platform/ai` (pestaña Precios) | `<Ai.ModelPrices :can-edit="isOwner" />` | `endpoint` (default `platform/ai`), `canEdit` |
| `/platform/ai` (pestaña Consumo) | `<Ai.UsageReport />` | `endpoint`, `tenantId` (filtra un espacio) |
| Backoffice › Sistema › IA › Consumo | `<Ai.UsageSummary :budget="presupuestoUsd" />` | `endpoint` (default `ai`), `budget` (USD/mes, opcional) |

- **ModelPrices**: precios editables en línea: entrada y salida por 1M de tokens, audio por minuto
  y voz (TTS) por 1M de caracteres. Vacío = sin precio.
- **UsageReport / UsageSummary**: selector de mes, costo estimado, usos y unidades, barras por día,
  consumo por función (resumen de llamadas, transcripción, copiloto en vivo, asistente, TTS, agente de
  voz, importación de PDF…), días de mayor consumo, por espacio (solo platform) y exportación CSV.
  Con `budget`, aviso al 80 % y al 100 % del presupuesto mensual.

## 3. Composables

- `useAiModelPrices({ base })` → `list`, `update`.
- `useAiUsage(monthRef, { base, scope: 'platform' | 'tenant', tenantId })` → query del resumen.
- Helpers puros (etiquetas de funciones, formato USD, navegación de meses, presupuesto) en
  `composables/useAiUsage/internal/aiUsage.ts`.
