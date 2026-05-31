export function useRoles() {
  const api = useApi()
  const queryClient = useQueryClient()

  // ─── Queries ──────────────────────────────────────────────────────────────

  const list = (params = {}) => useQuery({
    queryKey: computed(() => ['roles', toValue(params)]),
    queryFn: () => api.post('roles', toValue(params)),
  })

  const detail = (id) => useQuery({
    queryKey: computed(() => ['roles', toValue(id)]),
    queryFn: () => api.get(`roles/${toValue(id)}`),
    enabled: computed(() => !!toValue(id)),
  })

  // ─── Mutations ────────────────────────────────────────────────────────────

  const invalidateRoles = () => queryClient.invalidateQueries({ queryKey: ['roles'] })

  const create = () => useMutation({
    mutationFn: (data) => api.post('roles', data),
    onSuccess: invalidateRoles,
  })

  const update = () => useMutation({
    mutationFn: ({ id, ...data }) => api.put(`roles/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['roles', id] })
      invalidateRoles()
    },
  })

  const remove = () => useMutation({
    mutationFn: (id) => api.delete(`roles/${id}`),
    onSuccess: invalidateRoles,
  })

  const syncPermissions = () => useMutation({
    mutationFn: ({ id, permissions }) =>
      api.post(`roles/${id}/permissions`, { permissions }),
    onSuccess: (_, { id }) =>
      queryClient.invalidateQueries({ queryKey: ['roles', id] }),
  })

  return {
    // queries
    list, detail,
    // mutations
    create, update, remove, syncPermissions,
  }
}
