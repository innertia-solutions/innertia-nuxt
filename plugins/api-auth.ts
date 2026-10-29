export default defineNuxtPlugin(() => {
  const { add } = useRequestInterceptors()
  add((headers: Record<string, string>, options: Record<string, unknown>) => {
    // Authorization lo inyecta el BFF (server) desde la sesión sellada.
    // Aquí quedan solo headers no-sensibles (p. ej. multitenancy) si aplica.
    void options
    void headers
  })
})
