import { ref, readonly } from 'vue'
// useRequestInterceptors is auto-imported from this same package (nuxt-core)

const pusher = ref(null)
const connected = ref(false)
const error = ref(null)
const subscribedChannels = ref({})
let alreadyConnected = false

export function useRealtime() {
  const config = useRuntimeConfig()
  const {
    pusherAppKey,
    pusherAppCluster,
    pusherWsHost,
    pusherWsPort,
    pusherForceTLS,   // false para Soketi/Reverb local sin TLS (ws). Default true.
  } = config.public

  const connect = async () => {
    if (alreadyConnected || pusher.value) return

    if (!pusherAppKey) {
      error.value = '[nuxt-core] Falta runtimeConfig.public.pusherAppKey'
      console.error(error.value)
      return
    }

    const PusherModule = await import('pusher-js')
    // Interop CJS/ESM: el constructor puede estar en .default, .default.default o el módulo
    const Pusher = PusherModule.default?.default ?? PusherModule.default ?? PusherModule

    // Build auth headers from all registered interceptors (auth token, X-Tenant-Id, etc.)
    const { run } = useRequestInterceptors()
    const authHeaders = {}
    run(authHeaders)

    const tls = pusherForceTLS !== false // default true; false = ws plano (local)
    const options = {
      cluster: pusherAppCluster || 'mt1',
      forceTLS: tls,
      enabledTransports: tls ? ['ws', 'wss'] : ['ws'],
      disableStats: true,
      auth: {
        headers: authHeaders,
      },
    }

    // Socketi / host personalizado
    if (pusherWsHost) {
      options.wsHost = pusherWsHost
      options.wsPort = pusherWsPort ? Number(pusherWsPort) : 443
      options.wssPort = pusherWsPort ? Number(pusherWsPort) : 443
    }

    pusher.value = new Pusher(pusherAppKey, options)

    pusher.value.connection.bind('connected', () => {
      connected.value = true
      alreadyConnected = true
    })

    pusher.value.connection.bind('error', (err) => {
      error.value = err
      connected.value = false
      alreadyConnected = false
      pusher.value = null // allow reconnect after error
      console.error('[nuxt-core] Realtime error:', err)
    })

    pusher.value.connection.bind('disconnected', () => {
      connected.value = false
      alreadyConnected = false
    })
  }

  const subscribe = (channelName, eventHandlers = {}) => {
    if (!pusher.value) {
      console.warn(`[nuxt-core] Realtime no conectado. Canal "${channelName}" ignorado.`)
      return null
    }

    if (subscribedChannels.value[channelName]) {
      const channel = subscribedChannels.value[channelName]
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        channel.unbind(event)
        channel.bind(event, handler)
      })
      return channel
    }

    const channel = pusher.value.subscribe(channelName)
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      channel.bind(event, handler)
    })
    subscribedChannels.value[channelName] = channel
    return channel
  }

  const unsubscribe = (channelName) => {
    if (pusher.value && subscribedChannels.value[channelName]) {
      pusher.value.unsubscribe(channelName)
      delete subscribedChannels.value[channelName]
    }
  }

  const disconnect = () => {
    if (pusher.value) {
      Object.keys(subscribedChannels.value).forEach(ch => pusher.value.unsubscribe(ch))
      subscribedChannels.value = {}
      pusher.value.disconnect()
      pusher.value = null
      connected.value = false
      alreadyConnected = false
    }
  }

  return {
    pusherInstance: readonly(pusher),
    connected: readonly(connected),
    error: readonly(error),
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  }
}
