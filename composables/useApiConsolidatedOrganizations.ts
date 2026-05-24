/**
 * Wrapper de useApi que inyecta `X-Consolidated: true` en cada request.
 *
 * Úsalo solo en composables/páginas que requieren scope multi-org del backend
 * (ej. dashboards consolidados, reportes ejecutivos). El usuario debe tener
 * permisos correspondientes — el backend valida y filtra por `accessibleOrganizationIds()`.
 *
 * Uso típico:
 *   const api = useApiConsolidatedOrganizations()
 *   const stats = await api.get('reports/all-orgs-summary')
 *
 * El header se envía SIEMPRE en las requests hechas con esta instancia,
 * independiente del toggle global `organizationStore.consolidated`.
 */
export function useApiConsolidatedOrganizations() {
  const api = useApi()

  // Decora cada método para agregar el header X-Consolidated: true
  const withConsolidated = (options: any = {}) => ({
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      'X-Consolidated': 'true',
    },
  })

  return {
    get:    (url: string, options: any = {}) => api.get(url, withConsolidated(options)),
    post:   (url: string, data?: any, options: any = {}) => api.post(url, data, withConsolidated(options)),
    put:    (url: string, data?: any, options: any = {}) => api.put(url, data, withConsolidated(options)),
    patch:  (url: string, data?: any, options: any = {}) => api.patch(url, data, withConsolidated(options)),
    delete: (url: string, options: any = {}) => api.delete(url, withConsolidated(options)),
    upload: (url: string, data?: any, options: any = {}) => (api as any).upload?.(url, data, withConsolidated(options)),
  }
}
