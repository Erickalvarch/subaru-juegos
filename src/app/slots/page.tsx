'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'

type Prize = 'BACKPACK' | 'WATER' | 'TRY_AGAIN'
type ApiResp = { result?: Prize; error?: string }

const SYMBOLS: Array<{ key: Prize; label: string; icon: string }> = [
  { key: 'BACKPACK', label: 'Mochila', icon: '/assets/icon-mochila.png' },
  { key: 'WATER', label: 'Agua', icon: '/assets/icon-agua.png' },
  { key: 'TRY_AGAIN', label: 'Sigue participando', icon: '/assets/icon-sigue.png' },
]

// Duración de animación (mínimo 5s como la ruleta)
const SPIN_MS = 5200

export default function SlotsPage() {
  // Modo stand: un registro “rápido” para el notebook.
  // Puedes dejarlo así (staff escribe una vez y luego solo dispara),
  // o si prefieres “sin registro” en notebook lo ajustamos después.
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [busy, setBusy] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Prize | null>(null)
  const [confettiOn, setConfettiOn] = useState(false)
  const [glow, setGlow] = useState(false)

  // reels: indices a SYMBOLS
  const [reels, setReels] = useState<[number, number, number]>([0, 1, 2])

  // WebAudio tick
  const audioCtxRef = useRef<AudioContext | null>(null)
  const tickTimerRef = useRef<number | null>(null)

  function playTick() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    const ctx = audioCtxRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 900
    gain.gain.value = 0.06
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.03)
  }

  function startTicks() {
    stopTicks()
    let interval = 90
    const start = Date.now()
    tickTimerRef.current = window.setInterval(() => {
      playTick()
      const t = Date.now() - start
      if (t > 2600) interval = 130
      if (t > 4300) interval = 170
    }, interval)
  }

  function stopTicks() {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current)
      tickTimerRef.current = null
    }
  }

  function fireConfetti() {
    setConfettiOn(true)
    window.setTimeout(() => setConfettiOn(false), 1800)
  }

  const canPlay = useMemo(() => {
    return name.trim().length > 1 && email.trim().includes('@') && !busy && !spinning
  }, [name, email, busy, spinning])

  // Botón físico: Space o Enter dispara
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (canPlay) void spin()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canPlay])

  function randomReels() {
    const a = Math.floor(Math.random() * SYMBOLS.length)
    const b = Math.floor(Math.random() * SYMBOLS.length)
    const c = Math.floor(Math.random() * SYMBOLS.length)
    setReels([a, b, c])
  }

  function prizeToSymbolIndex(p: Prize) {
    return SYMBOLS.findIndex(s => s.key === p)
  }

  async function spin() {
    setBusy(true)
    setSpinning(true)
    setError(null)
    setResult(null)
    setGlow(false)

    startTicks()

    // animación visual: cambiamos reels rápidamente mientras “corre”
    const start = Date.now()
    const anim = window.setInterval(() => {
      randomReels()
      // va desacelerando al final
      const t = Date.now() - start
      if (t > 3500) {
        // hacemos cambios menos frecuentes
        // (no cambiamos el interval aquí para no complicar; igual se ve bien)
      }
    }, 90)

    try {
      const res = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, gameType: 'slots' }),
      })
      const data: ApiResp = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error')
        stopTicks()
        clearInterval(anim)
        setSpinning(false)
        return
      }

      const prize = data.result
      if (!prize) {
        setError('No llegó resultado desde el servidor')
        stopTicks()
        clearInterval(anim)
        setSpinning(false)
        return
      }

      // Al final fijamos reels: 3 iguales del premio
      const idx = Math.max(0, prizeToSymbolIndex(prize))

      window.setTimeout(() => {
        clearInterval(anim)
        stopTicks()

        setReels([idx, idx, idx])
        setResult(prize)
        setSpinning(false)

        if (prize === 'BACKPACK') {
          setGlow(true)
          window.setTimeout(() => setGlow(false), 2400)
        }

        if (prize === 'BACKPACK' || prize === 'WATER') {
          fireConfetti()
        }
      }, SPIN_MS)
    } catch (e: any) {
      clearInterval(anim)
      stopTicks()
      setError(e?.message ?? 'Error de red')
      setSpinning(false)
    } finally {
      setBusy(false)
    }
  }

  const resultText =
    result === 'BACKPACK'
      ? '¡Ganaste Mochila!'
      : result === 'WATER'
      ? 'Ganaste Agua'
      : result === 'TRY_AGAIN'
      ? 'Sigue participando'
      : null

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 18,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        backgroundImage: `linear-gradient(rgba(0,0,0,.6), rgba(0,0,0,.82)), url(/assets/fondo.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {confettiOn && <ConfettiOverlay />}

      <div
        style={{
          width: '100%',
          maxWidth: 980,
          borderRadius: 20,
          padding: 22,
          background: 'rgba(10,10,10,0.62)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 18px 70px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
          <div />
          <div style={{ display: 'grid', placeItems: 'center', gap: 8 }}>
            <Image src="/assets/titulo-evento.png" alt="Título evento" width={520} height={140} priority
              style={{ width: 'min(520px, 100%)', height: 'auto' }} />
            <div style={{ opacity: 0.85, fontWeight: 700 }}>
              Tragamonedas (Notebook) • Presiona <kbd style={kbdStyle}>ESPACIO</kbd> o <kbd style={kbdStyle}>ENTER</kbd>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{
              width: 84, height: 84, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(0,0,0,0.55)',
              display: 'grid', placeItems: 'center',
            }}>
              <Image src="/assets/logo-subaru_azul.png" alt="Subaru" width={64} height={64}
                style={{ width: 64, height: 64, objectFit: 'contain' }} />
            </div>
          </div>
        </div>

        {/* Inputs (una vez por persona) */}
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
          <input
            style={inputStyle}
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy || spinning}
          />
          <input
            style={inputStyle}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy || spinning}
          />

          <button
            onClick={spin}
            disabled={!canPlay}
            style={{
              padding: '14px 18px',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.18)',
              fontWeight: 900,
              letterSpacing: 1.0,
              textTransform: 'uppercase',
              background: canPlay
                ? 'linear-gradient(180deg, #1E88E5 0%, #0B3D91 100%)'
                : 'rgba(255,255,255,0.12)',
              color: '#fff',
              boxShadow: canPlay ? '0 10px 30px rgba(30,136,229,0.35)' : 'none',
              opacity: canPlay ? 1 : 0.55,
              cursor: canPlay ? 'pointer' : 'not-allowed',
              minWidth: 220,
            }}
          >
            {spinning ? 'GIRANDO…' : 'GIRAR'}
          </button>
        </div>

        {/* Slot machine */}
        <div style={{ marginTop: 18, display: 'grid', placeItems: 'center' }}>
          <div style={{
            width: 'min(860px, 100%)',
            borderRadius: 22,
            border: '1px solid rgba(255,255,255,0.16)',
            background: 'rgba(0,0,0,0.45)',
            padding: 18,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
          }}>
            {glow && (
              <div style={{
                position: 'absolute',
                inset: -40,
                background: 'radial-gradient(circle, rgba(30,136,229,0.55), rgba(30,136,229,0.08) 55%, rgba(0,0,0,0) 70%)',
                filter: 'blur(2px)',
                zIndex: 0,
                animation: 'pulse 0.8s ease-in-out infinite alternate',
              }} />
            )}

            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <Reel symbol={SYMBOLS[reels[0]]} spinning={spinning} />
              <Reel symbol={SYMBOLS[reels[1]]} spinning={spinning} />
              <Reel symbol={SYMBOLS[reels[2]]} spinning={spinning} />
            </div>

            {/* brillo central */}
            <div style={{
              position: 'absolute',
              left: 0, right: 0, top: 0, bottom: 0,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.0) 35%, rgba(0,0,0,0) 60%, rgba(255,255,255,0.05))',
              pointerEvents: 'none',
            }} />
          </div>
        </div>

        {/* Resultado */}
        {(resultText || error) && (
          <div style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}>
            {result && (
              <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: 0.2 }}>
                {result === 'BACKPACK' ? '🎒' : result === 'WATER' ? '💧' : '🙌'} {resultText}
              </div>
            )}
            {error && <div style={{ fontSize: 16 }}><b>Error:</b> {error}</div>}
            <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
              * 1 participación por persona durante la campaña. Premios sujetos a stock diario y validación en stand.
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes pulse {
            from { transform: scale(0.98); opacity: 0.8; }
            to   { transform: scale(1.03); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  )
}

function Reel({ symbol, spinning }: { symbol: { label: string; icon: string }, spinning: boolean }) {
  return (
    <div style={{
      borderRadius: 18,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.06)',
      padding: 18,
      minHeight: 220,
      display: 'grid',
      placeItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: spinning ? 0.65 : 0,
        transition: 'opacity 300ms ease',
        background: 'radial-gradient(circle at 50% 30%, rgba(30,136,229,0.25), rgba(0,0,0,0))',
        pointerEvents: 'none',
      }} />
      <Image src={symbol.icon} alt={symbol.label} width={120} height={120}
        style={{ width: 120, height: 120, objectFit: 'contain' }} />
      <div style={{
        marginTop: 10,
        fontWeight: 900,
        fontSize: 22,
        textShadow: '0 2px 10px rgba(0,0,0,0.6)',
      }}>
        {symbol.label}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 14,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  outline: 'none',
  fontSize: 16,
}

const kbdStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(0,0,0,0.35)',
  fontWeight: 900,
}

function ConfettiOverlay() {
  const pieces = Array.from({ length: 90 })
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 9999 }}>
      {pieces.map((_, i) => {
        const left = Math.random() * 100
        const delay = Math.random() * 0.25
        const duration = 1.2 + Math.random() * 0.9
        const size = 6 + Math.random() * 9
        const rotate = Math.random() * 360
        const drift = Math.random() * 140 - 70

        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-10%',
              left: `${left}%`,
              width: size,
              height: size * 0.6,
              background: 'white',
              borderRadius: 2,
              opacity: 0.95,
              transform: `rotate(${rotate}deg)`,
              animation: `confettiFall ${duration}s ease-in ${delay}s forwards`,
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
              ['--drift' as any]: `${drift}px`,
            } as React.CSSProperties}
          />
        )
      })}

      <style jsx>{`
        @keyframes confettiFall {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--drift), 120vh, 0) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
