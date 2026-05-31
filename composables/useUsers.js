export function useUsers() {
  const api = useApi()
  const queryClient = useQueryClient()

  // ─── Queries ──────────────────────────────────────────────────────────────

  const list = (params = {}) => useQuery({
    queryKey: computed(() => ['users', toValue(params)]),
    queryFn: () => api.post('users', toValue(params)),
  })

  const detail = (id) => useQuery({
    queryKey: computed(() => ['users', toValue(id)]),
    queryFn: () => api.get(`users/${toValue(id)}`),
    enabled: computed(() => !!toValue(id)),
  })

  const roles = (userId) => useQuery({
    queryKey: computed(() => ['users', toValue(userId), 'roles']),
    queryFn: () => api.get(`users/${toValue(userId)}/roles`),
    enabled: computed(() => !!toValue(userId)),
  })

  const apps = (userId) => useQuery({
    queryKey: computed(() => ['users', toValue(userId), 'apps']),
    queryFn: () => api.get(`users/${toValue(userId)}/apps`),
    enabled: computed(() => !!toValue(userId)),
  })

  const sessions = (userId) => useQuery({
    queryKey: computed(() => ['users', toValue(userId), 'sessions']),
    queryFn: () => api.get(`users/${toValue(userId)}/sessions`),
    enabled: computed(() => !!toValue(userId)),
  })

  const activityLog = (userId, params = {}) => useQuery({
    queryKey: computed(() => ['users', toValue(userId), 'activity', toValue(params)]),
    queryFn: () => api.get(`users/${toValue(userId)}/activity`, toValue(params)),
    enabled: computed(() => !!toValue(userId)),
  })

  // ─── Mutations ────────────────────────────────────────────────────────────

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const create = () => useMutation({
    mutationFn: (data) => api.post('users', data),
    onSuccess: invalidateUsers,
  })

  const update = () => useMutation({
    mutationFn: ({ id, ...data }) => api.put(`users/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['users', id] })
      invalidateUsers()
    },
  })

  const remove = () => useMutation({
    mutationFn: (id) => api.delete(`users/${id}`),
    onSuccess: invalidateUsers,
  })

  const reactivate = () => useMutation({
    mutationFn: (id) => api.post(`users/${id}/reactivate`),
    onSuccess: invalidateUsers,
  })

  const resetPassword = () => useMutation({
    mutationFn: ({ id, ...data }) => api.post(`users/${id}/reset-password`, data),
  })

  const assignRole = () => useMutation({
    mutationFn: ({ userId, role }) => api.post(`users/${userId}/roles`, { role }),
    onSuccess: (_, { userId }) =>
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'roles'] }),
  })

  const removeRole = () => useMutation({
    mutationFn: ({ userId, role }) => api.delete(`users/${userId}/roles/${role}`),
    onSuccess: (_, { userId }) =>
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'roles'] }),
  })

  const syncApps = () => useMutation({
    mutationFn: ({ userId, apps }) => api.post(`users/${userId}/apps/sync`, { apps }),
    onSuccess: (_, { userId }) =>
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'apps'] }),
  })

  const revokeSession = () => useMutation({
    mutationFn: ({ userId, sessionId }) =>
      api.delete(`users/${userId}/sessions/${sessionId}`),
    onSuccess: (_, { userId }) =>
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'sessions'] }),
  })

  const revokeAllSessions = () => useMutation({
    mutationFn: (userId) => api.delete(`users/${userId}/sessions`),
    onSuccess: (_, userId) =>
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'sessions'] }),
  })

  return {
    // queries
    list, detail, roles, apps, sessions, activityLog,
    // mutations
    create, update, remove, reactivate, resetPassword,
    assignRole, removeRole, syncApps, revokeSession, revokeAllSessions,
  }
}
