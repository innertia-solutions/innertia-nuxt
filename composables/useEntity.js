/**
 * PLANTILLA BASE — copiar y renombrar para cada nueva entidad.
 *
 * Convención de uso en componentes (siempre en setup(), no en callbacks):
 *
 *   const { list, detail, create, update, remove } = useEntity()
 *
 *   // Query reactiva — re-fetcha automáticamente cuando cambian los params
 *   const { data, isLoading } = list(filters)
 *
 *   // Detail con id reactivo
 *   const { data: entity } = detail(route.params.id)
 *
 *   // Mutaciones
 *   const { mutate: createEntity, isPending } = create()
 *   const { mutate: updateEntity } = update()
 *   const { mutate: deleteEntity } = remove()
 *
 *   // Ejecutar mutación
 *   createEntity({ name: 'Nuevo' })
 *   updateEntity({ id: '123', name: 'Editado' })
 *   deleteEntity('123')
 *
 * Capas:
 *   useEntity   →  qué datos, cuándo, cómo se invalidan
 *   useApi      →  cómo viaja la petición HTTP (headers, auth, tenant)
 *   QueryClient →  cache compartido entre componentes
 */

// ── Rename: useEntity → use{Entity}, 'entities' → '{entity}s' ───────────────

export function useEntity() {
  const api = useApi()
  const queryClient = useQueryClient()

  // ─── Queries ──────────────────────────────────────────────────────────────

  const list = (params = {}) => useQuery({
    queryKey: computed(() => ['entities', toValue(params)]),
    queryFn: () => api.post('backoffice/entities', toValue(params)),
  })

  const detail = (id) => useQuery({
    queryKey: computed(() => ['entities', toValue(id)]),
    queryFn: () => api.get(`backoffice/entities/${toValue(id)}`),
    enabled: computed(() => !!toValue(id)),
  })

  // ─── Mutations ────────────────────────────────────────────────────────────

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['entities'] })

  const create = () => useMutation({
    mutationFn: (data) => api.post('backoffice/entities', data),
    onSuccess: invalidate,
  })

  const update = () => useMutation({
    mutationFn: ({ id, ...data }) => api.put(`backoffice/entities/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['entities', id] })
      invalidate()
    },
  })

  const remove = () => useMutation({
    mutationFn: (id) => api.delete(`backoffice/entities/${id}`),
    onSuccess: invalidate,
  })

  // Agregar acciones adicionales siguiendo el mismo patrón:
  //
  // const activate = () => useMutation({
  //   mutationFn: (id) => api.post(`backoffice/entities/${id}/activate`),
  //   onSuccess: invalidate,
  // })

  return {
    list, detail,
    create, update, remove,
  }
}
