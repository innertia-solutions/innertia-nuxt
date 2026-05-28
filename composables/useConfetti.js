/**
 * useConfetti — Animación de confetti zero-deps en canvas overlay.
 *
 * ```js
 * const { burst, fireworks, cannon, schoolPride, stop } = useConfetti()
 *
 * burst()                                // explosión simple en el centro
 * burst({ origin: { x: 0.5, y: 0.3 } })  // explosión desde un punto (0-1)
 * burst({ colors: ['#ff0', '#0f0'] })    // colores custom
 * fireworks({ duration: 3000 })          // fuegos artificiales 3s
 * cannon({ angle: 60, spread: 55 })      // un solo "cañon"
 * schoolPride(['#ff0066', '#33ccff'])    // dos cañones laterales
 * ```
 *
 * El canvas se monta una sola vez en <body>, full-screen, pointer-events: none,
 * z-index altísimo. Se limpia automáticamente cuando no hay partículas.
 */

const DEFAULT_COLORS = ['#FF3E7F', '#FFC23C', '#3CDBFF', '#7B61FF', '#27D67B', '#FF7A45']
const GRAVITY = 0.18
const DRAG = 0.012

let canvas = null
let ctx = null
let particles = []
let rafId = null
let resizeHandler = null

function ensureCanvas() {
  if (typeof window === 'undefined') return null
  if (canvas) return canvas
  canvas = document.createElement('canvas')
  canvas.setAttribute('data-innertia-confetti', '')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '99999',
  })
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
  resize()
  resizeHandler = () => resize()
  window.addEventListener('resize', resizeHandler)
  return canvas
}

function resize() {
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  canvas.width  = window.innerWidth  * dpr
  canvas.height = window.innerHeight * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function destroyCanvas() {
  if (!canvas) return
  canvas.remove()
  canvas = null
  ctx = null
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  resizeHandler = null
}

function spawnParticles({
  origin = { x: 0.5, y: 0.5 },
  count = 80,
  spread = 70,
  angle = 90,        // 90 = arriba, 0 = derecha, 180 = izquierda
  velocity = 18,
  colors = DEFAULT_COLORS,
  shapes = ['square', 'circle', 'rect'],
  ticks = 200,       // vida en frames
  scalar = 1,
} = {}) {
  ensureCanvas()
  if (!ctx) return

  const radSpread = (spread * Math.PI) / 180
  const radAngle  = (angle  * Math.PI) / 180
  const ox = origin.x * window.innerWidth
  const oy = origin.y * window.innerHeight

  for (let i = 0; i < count; i++) {
    const a = radAngle - radSpread / 2 + Math.random() * radSpread
    const v = velocity * (0.5 + Math.random() * 0.7)
    particles.push({
      x: ox,
      y: oy,
      vx:  Math.cos(a) * v,
      vy: -Math.sin(a) * v,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      size: (5 + Math.random() * 6) * scalar,
      color: colors[(Math.random() * colors.length) | 0],
      shape: shapes[(Math.random() * shapes.length) | 0],
      life: 0,
      maxLife: ticks * (0.7 + Math.random() * 0.6),
      wobble: Math.random() * 2 * Math.PI,
      wobbleSpeed: 0.05 + Math.random() * 0.05,
    })
  }

  if (!rafId) tick()
}

function tick() {
  if (!ctx) { rafId = null; return }
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.vx *= 1 - DRAG
    p.vy = p.vy * (1 - DRAG) + GRAVITY
    p.x += p.vx
    p.y += p.vy
    p.rot += p.vrot
    p.wobble += p.wobbleSpeed
    p.life++

    if (p.life >= p.maxLife || p.y > window.innerHeight + 40) {
      particles.splice(i, 1)
      continue
    }

    const alpha = Math.max(0, 1 - p.life / p.maxLife)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(p.x + Math.cos(p.wobble) * 2, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = p.color

    if (p.shape === 'circle') {
      ctx.beginPath()
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
      ctx.fill()
    } else if (p.shape === 'rect') {
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
    } else {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
    }
    ctx.restore()
  }

  if (particles.length) {
    rafId = requestAnimationFrame(tick)
  } else {
    rafId = null
    // Mantener el canvas montado — limpiarlo es opcional. Lo dejamos para no
    // recrear elementos en bursts repetidos.
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

export function useConfetti() {
  /** Explosión simple. */
  const burst = (opts = {}) => spawnParticles({ count: 90, spread: 70, velocity: 22, ...opts })

  /** Un "cañón" direccional (ej. desde una esquina). */
  const cannon = (opts = {}) => spawnParticles({ count: 60, spread: 30, velocity: 25, ...opts })

  /** Dos cañones laterales con colores propios. */
  const schoolPride = (colors = DEFAULT_COLORS, opts = {}) => {
    spawnParticles({ origin: { x: 0,  y: 0.7 }, angle: 60,  spread: 55, count: 50, colors, velocity: 25, ...opts })
    spawnParticles({ origin: { x: 1,  y: 0.7 }, angle: 120, spread: 55, count: 50, colors, velocity: 25, ...opts })
  }

  /** Fuegos artificiales repetidos durante `duration` ms. */
  const fireworks = ({ duration = 3000, interval = 250, ...opts } = {}) => {
    const end = Date.now() + duration
    const iv  = setInterval(() => {
      if (Date.now() >= end) { clearInterval(iv); return }
      spawnParticles({
        origin: { x: 0.2 + Math.random() * 0.6, y: 0.3 + Math.random() * 0.3 },
        count: 40,
        spread: 360,
        velocity: 18,
        ...opts,
      })
    }, interval)
    return () => clearInterval(iv)
  }

  /** Limpia todas las partículas activas y destruye el canvas. */
  const stop = () => {
    particles = []
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    destroyCanvas()
  }

  return { burst, cannon, schoolPride, fireworks, stop }
}
