# Google Drive y versiones de archivos

Componentes para importar desde Google Drive al storage del producto, elegir una carpeta de Drive como configuración, ver el origen de un archivo importado (con "Actualizar") y gestionar el historial de versiones. Se apoyan en `\Innertia\Files` de innertia-laravel.

> En los productos los componentes se usan con la notación con punto (`<Files.DriveImport>`, `<Files.VersionHistory>`, …). Dentro de la librería se referencian sin punto (`<FilesDriveBrowser>`).

## Requisitos (backend Laravel)

1. **Proveedor conectado:** Google Drive conectado vía `\Innertia\Files\Routes::registerProviderConnections()` (ver `<Files.ProviderConnectButton>`).
2. **Rutas de Drive e importaciones** (opt-in), dentro del grupo autenticado del producto:

   ```php
   \Innertia\Files\Routes::registerDriveImport('platform');
   ```

   Con prefijo `platform` quedan:

   | Método | Ruta | Uso |
   |---|---|---|
   | GET  | `platform/drive/browse?parent=&drive_id=&folders_only=` | listar carpeta (`items`, y `shared_drives` en la raíz) |
   | GET  | `platform/drive/items/{id}` | metadatos + ruta (`{ item, path }`) |
   | POST | `platform/drive/folders` | crear carpeta (`{ name, parent }`) |
   | POST | `platform/files/imports` | iniciar importación (202, corre en cola) |
   | GET  | `platform/files/imports/{id}` | estado del proceso |
   | POST | `platform/files/{id}/refresh` | actualizar un archivo desde Drive (202) |

   El valor del prop `drive-base` de los componentes es ese mismo prefijo (`'platform'`, o `''` si se registró sin prefijo).
3. **Versiones:** `\Innertia\Files\Routes::register('platform/files')` ya expone `GET {id}/versions`, `POST {id}/versions/{n}/restore` y `POST {id}/contents` (multipart, campo `file`). El prop `files-base` es ese prefijo (`'platform/files'`).
4. Un worker de cola corriendo: importaciones y refresh son asíncronos; el front consulta el estado cada 2 s hasta `done`/`failed`.

## Componentes

### `<Files.DriveBrowser>`

Panel para navegar Mi unidad y las unidades compartidas, con migas y "Nueva carpeta".

| Prop | Tipo | Default | |
|---|---|---|---|
| `drive-base` | String | `''` | prefijo de las rutas de Drive |
| `mode` | `'items' \| 'folder'` | `'items'` | `items`: v-model con la selección; `folder`: solo carpetas, emite `pick` |
| `v-model` | `DriveEntry[]` | `[]` | selección (modo `items`) |
| `multiple` | Boolean | `true` | selección múltiple (tope 200) |
| `accept` | String[] | `[]` | mimes o comodines (`'image/*'`); con filtro las carpetas solo se navegan |
| `start-at` | String | `null` | abre el panel en esa carpeta |
| `allow-create` | Boolean | `true` | muestra "Nueva carpeta" |

Eventos: `update:modelValue`, `pick({ id, name })` (modo `folder`, botón "Usar …"; la raíz de Mi unidad no es elegible).

### `<Files.DriveFolderField>`

Campo de formulario "carpeta de Google Drive". `v-model` = id de la carpeta (`''` = ninguna). Muestra nombre, ruta y enlace a Drive, y abre `<Files.DriveBrowser mode="folder">` en un modal.

Props: `v-model`, `drive-base`, `title` (título del modal).

### `<Files.DriveImport>`

Modal autocontenido: **elegir → opciones → progreso/resumen**. Cerrar no cancela el proceso.

| Prop | Tipo | Default | |
|---|---|---|---|
| `v-model` | Boolean | `false` | abierto/cerrado |
| `drive-base` | String | `''` | prefijo de las rutas |
| `directory-id` | String | `null` | directorio destino |
| `folders-allowed` | Boolean | `true` | `false` si el producto no usa Directories: bloquea carpetas en la selección |
| `visibility` | String | `null` | `public \| auth \| restricted` para los archivos creados |
| `resume-id` | String | `null` | reabre el seguimiento de un import en curso |

Eventos: `update:modelValue`, `done(import)` al terminar (`done` o `failed`). Si hay documentos nativos de Google (Docs/Sheets/Slides) ofrece formato Office o PDF.

### `<Files.ProviderOrigin>`

Franja "Importado de Google Drive · sincronizado …" con "Abrir en Drive" y "Actualizar" (si `file.can_refresh`). No se muestra si `file.provider` está vacío.

Props: `file` (FileResource), `drive-base`. Evento: `changed` cuando el refresh creó una versión nueva (avisa con toast tanto si hubo cambios como si no).

### `<Files.VersionHistory>`

Lista de versiones (fuente, fecha, tamaño, vigente) con descarga, "Restaurar" (crea una versión nueva, pide confirmación) y "Subir nueva versión".

Props: `files-base` (requerido), `file-id` (requerido), `allow-restore` (true), `allow-upload` (true). Evento: `changed(file)` cuando se creó una versión.

## Composables

Auto-importados: `useDriveBrowser({ base, foldersOnly?, enabled? })`, `useFileImports(base)` (`start`, `refresh`, `track(importIdRef)`) y `useFileVersions({ filesBase, fileId })` (`list`, `restore`, `replace`). Los helpers de `internal/` no se auto-importan.

## Ejemplo en un explorador de producto

```vue
<script setup>
const showImport = ref(false)
const selected = ref(null) // archivo en vista previa
const { data, refetch } = useQuery(/* … listado del directorio actual … */)
</script>

<template>
  <!-- Barra del explorador -->
  <AppButton text="Importar desde Drive" @click="showImport = true" />
  <Files.DriveImport v-model="showImport" drive-base="platform" :directory-id="currentDir?.id" @done="refetch" />

  <!-- Vista previa -->
  <template v-if="selected">
    <Files.ProviderOrigin :file="selected" drive-base="platform" @changed="refetch" />
    <Files.VersionHistory files-base="platform/files" :file-id="selected.id" @changed="refetch" />
  </template>
</template>
```

Configuración (p. ej. carpeta por defecto para exportaciones):

```vue
<Files.DriveFolderField v-model="form.drive_folder_id" drive-base="platform" />
```
