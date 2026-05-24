export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig() as { spark?: { theme?: string } }
  const theme = appConfig.spark?.theme
  if (theme && theme !== 'default') {
    document.documentElement.setAttribute('data-theme', `theme-${theme}`)
  }
})
