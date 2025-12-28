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

const SPIN_MS = 5200

export default function SlotsPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [busy, setBusy] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Prize | null>(null)
  const [confettiOn, setConfettiOn] = useState(false)
  const [glow, setGlow] = useState(false)

  // reels display
  const [reels, setReels] = useState<[number, number, number]>([0, 1, 2])
  const [spinPhase, setSpinPhase] = useState<'idle' | 'spinning' | 'stopping'>('idle')

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
    osc.frequency.value = 980
    gain.gain.value = 0.055
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.03)
  }

  function startTicks() {
    stopTicks()
    let interval = 85
    const start = Date.now()
    tickTimerRef.current = window.setInterval(() => {
      playTick()
      const t = Date.now() - start
      if (t > 2600) interval = 120
      if (t > 4300) interval = 165
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

  // Botón físico: Space o Enter
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
    return SYMBOLS.findIndex((s) => s.key === p)
  }

  async function spin() {
    setBusy(true)
    setSpinning(true)
    setSpinPhase('spinning')
    setError(null)
    setResult(null)
    setGlow(false)

    startTicks()

    // animación “reel” con cambios rápidos
    const start = Date.now()
    const anim = window.setInterval(() => {
      randomReels()
      const t = Date.now() - start
      if (t > 3800) {
        // últimos segundos: se ve más “pesado”
        // (sin complicar interval variable)
      }
    }, 80)

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
        setSpinPhase('idle')
        return
      }

      const prize = data.result
      if (!prize) {
        setError('No llegó resultado desde el servidor')
        stopTicks()
        clearInterval(anim)
        setSpinning(false)
        setSpinPhase('idle')
        return
      }

      const idx = Math.max(0, prizeToSymbolIndex(prize))

      // Antes del stop, marcamos fase “stopping” para bajar blur/velocidad visual
      window.setTimeout(() => setSpinPhase('stopping'), SPIN_MS - 800)

      window.setTimeout(() => {
        clearInterval(anim)
        stopTicks()

        setReels([idx, idx, idx])
        setResult(prize)
        setSpinning(false)
        setSpinPhase('idle')

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
      setSpinPhase('idle')
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
        backgroundImage: `
          radial-gradient(circle at 20% 10%, rgba(30,136,229,0.28), rgba(0,0,0,0) 45%),
          radial-gradient(circle at 80% 30%, rgba(255,255,255,0.10), rgba(0,0,0,0) 40%),
          linear-gradient(rgba(0,0,0,.65), rgba(0,0,0,.88)),
          url(/assets/fondo.jpg)
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {confettiOn && <ConfettiOverlay />}

      <div
        style={{
          width: '100%',
          maxWidth: 980,
          borderRadius: 22,
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
            <Image
              src="/assets/titulo-evento.png"
              alt="Título evento"
              width={520}
              height={140}
              priority
              style={{ width: 'min(520px, 100%)', height: 'auto' }}
            />
            <div style={{ opacity: 0.9, fontWeight: 800 }}>
              Presiona <kbd style={kbdStyle}>ESPACIO</kbd> o <kbd style={kbdStyle}>ENTER</kbd>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(0,0,0,0.55)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Image
                src="/assets/logo-subaru_azul.png"
                alt="Subaru"
                width={64}
                height={64}
                style={{ width: 64, height: 64, objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>

        {/* Inputs */}
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

          <button onClick={spin} disabled={!canPlay} style={primaryBtn(canPlay)}>
            {spinning ? 'GIRANDO…' : 'GIRAR'}
          </button>
        </div>

        {/* Slot Machine (CENTRAL como imagen ref) */}
        <div style={{ marginTop: 18, display: 'grid', placeItems: 'center' }}>
          <div
            style={{
              width: 'min(900px, 100%)',
              position: 'relative',
              padding: 18,
              borderRadius: 28,
              // Marco “azul neon / chrome”
              background: `
                linear-gradient(180deg, rgba(35,144,255,0.40), rgba(2,18,45,0.65)),
                radial-gradient(circle at 20% 10%, rgba(255,255,255,0.22), rgba(0,0,0,0) 40%),
                radial-gradient(circle at 80% 70%, rgba(35,144,255,0.25), rgba(0,0,0,0) 45%)
              `,
              border: '1px solid rgba(255,255,255,0.16)',
              boxShadow: '0 20px 80px rgba(0,0,0,0.75)',
              overflow: 'hidden',
            }}
          >
            {/* luces */}
            <div style={lightsTopStyle} />
            <div style={lightsBottomStyle} />

            {/* Palanca derecha */}
            <Lever active={spinning} />

            {/* Glow extra cuando mochila */}
            {glow && <div style={glowStyle} />}

            {/* Ventana “vidrio” */}
            <div
              style={{
                position: 'relative',
                marginRight: 64, // deja espacio palanca
                borderRadius: 22,
                padding: 16,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
                overflow: 'hidden',
              }}
            >
              {/* Reflejo vidrio */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.0) 35%, rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.0) 72%)',
                  opacity: 0.55,
                  pointerEvents: 'none',
                  transform: 'translateX(-15%)',
                }}
              />

              {/* Reels */}
              <div
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 14,
                }}
              >
                <ReelGlass symbol={SYMBOLS[reels[0]]} phase={spinPhase} />
                <ReelGlass symbol={SYMBOLS[reels[1]]} phase={spinPhase} />
                <ReelGlass symbol={SYMBOLS[reels[2]]} phase={spinPhase} />
              </div>

              {/* Sombra central / foco */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.0) 70%, rgba(0,0,0,0.08))',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Monedas y destellos decorativos */}
            <Coin x="8%" y="18%" s={42} r={-12} />
            <Coin x="84%" y="16%" s={34} r={16} />
            <Coin x="22%" y="84%" s={30} r={8} />
            <Sparkle x="76%" y="78%" />
            <Sparkle x="12%" y="64%" />

            {/* Texto mini inferior dentro de la máquina */}
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 900,
                letterSpacing: 0.5,
              }}
            >
              <div style={{ opacity: 0.9 }}>SUBARU • SLOT</div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>
                {spinning ? 'Girando…' : 'Listo'} • 1 participación por campaña
              </div>
            </div>
          </div>
        </div>

        {/* Resultado */}
        {(resultText || error) && (
          <div
            style={{
              marginTop: 14,
              padding: 16,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              textAlign: 'center',
            }}
          >
            {result && (
              <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: 0.2 }}>
                {result === 'BACKPACK' ? '🎒' : result === 'WATER' ? '💧' : '🙌'} {resultText}
              </div>
            )}
            {error && (
              <div style={{ fontSize: 16 }}>
                <b>Error:</b> {error}
              </div>
            )}
            <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
              * Premios sujetos a stock diario y validación en stand.
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes leverPull {
            0% {
              transform: translateY(0);
            }
            30% {
              transform: translateY(22px);
            }
            100% {
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  )
}

function ReelGlass({
  symbol,
  phase,
}: {
  symbol: { label: string; icon: string }
  phase: 'idle' | 'spinning' | 'stopping'
}) {
  const blur = phase === 'spinning' ? 2.4 : phase === 'stopping' ? 1.1 : 0
  const glow = phase === 'idle' ? 0.18 : 0.28

  return (
    <div
      style={{
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.18)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(0,0,0,0.08))',
        padding: 18,
        minHeight: 250,
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {/* brillo interno */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 35%, rgba(35,144,255,${glow}), rgba(0,0,0,0) 55%)`,
          pointerEvents: 'none',
        }}
      />
      {/* máscara (ventana) */}
      <div
        style={{
          width: '100%',
          borderRadius: 14,
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.10)',
          padding: 14,
          display: 'grid',
          justifyItems: 'center',
          gap: 10,
          filter: `blur(${blur}px)`,
          transition: 'filter 250ms ease',
        }}
      >
        <Image
          src={symbol.icon}
          alt={symbol.label}
          width={130}
          height={130}
          style={{ width: 130, height: 130, objectFit: 'contain' }}
        />
        <div
          style={{
            fontWeight: 950,
            fontSize: 22,
            textShadow: '0 2px 12px rgba(0,0,0,0.7)',
          }}
        >
          {symbol.label}
        </div>
      </div>

      {/* reflejo superior */}
      <div
        style={{
          position: 'absolute',
          left: -40,
          top: -30,
          width: 220,
          height: 220,
          background: 'radial-gradient(circle, rgba(255,255,255,0.25), rgba(255,255,255,0) 60%)',
          transform: 'rotate(18deg)',
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

function Lever({ active }: { active: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 90,
        right: 18,
        width: 52,
        height: 260,
        display: 'grid',
        placeItems: 'start center',
        zIndex: 3,
      }}
    >
      {/* varilla */}
      <div
        style={{
          width: 12,
          height: 200,
          borderRadius: 20,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(0,0,0,0.2))',
          border: '1px solid rgba(255,255,255,0.16)',
          boxShadow: '0 12px 35px rgba(0,0,0,0.55)',
          position: 'relative',
          transformOrigin: 'top center',
          animation: active ? 'leverPull 0.55s ease-in-out 1' : 'none',
        }}
      >
        {/* bola */}
        <div
          style={{
            position: 'absolute',
            top: -18,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 34,
            height: 34,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75), rgba(255,0,70,0.85) 45%, rgba(70,0,0,0.9))',
            border: '1px solid rgba(255,255,255,0.20)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      {/* base */}
      <div
        style={{
          marginTop: 10,
          width: 42,
          height: 42,
          borderRadius: 14,
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      />
    </div>
  )
}

function Coin({ x, y, s, r }: { x: string; y: string; s: number; r: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: s,
        height: s,
        borderRadius: '50%',
        transform: `rotate(${r}deg)`,
        background:
          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(255,215,0,0.85) 40%, rgba(120,60,0,0.85))',
        boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.20)',
        opacity: 0.9,
      }}
    />
  )
}

function Sparkle({ x, y }: { x: string; y: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 26,
        height: 26,
        background:
          'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.0) 70%)',
        filter: 'drop-shadow(0 10px 25px rgba(35,144,255,0.35))',
        opacity: 0.85,
      }}
    />
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

function primaryBtn(enabled: boolean): React.CSSProperties {
  return {
    padding: '14px 18px',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.18)',
    fontWeight: 900,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    background: enabled ? 'linear-gradient(180deg, #1E88E5 0%, #0B3D91 100%)' : 'rgba(255,255,255,0.12)',
    color: '#fff',
    boxShadow: enabled ? '0 10px 30px rgba(30,136,229,0.35)' : 'none',
    opacity: enabled ? 1 : 0.55,
    cursor: enabled ? 'pointer' : 'not-allowed',
    minWidth: 220,
  }
}

const kbdStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(0,0,0,0.35)',
  fontWeight: 900,
}

const glowStyle: React.CSSProperties = {
  position: 'absolute',
  inset: -80,
  background:
    'radial-gradient(circle, rgba(35,144,255,0.55), rgba(35,144,255,0.08) 55%, rgba(0,0,0,0) 72%)',
  filter: 'blur(2px)',
  zIndex: 0,
  opacity: 0.9,
  pointerEvents: 'none',
}

const lightsTopStyle: React.CSSProperties = {
  position: 'absolute',
  left: -80,
  right: -80,
  top: -110,
  height: 180,
  background:
    'radial-gradient(circle at 35% 70%, rgba(255,255,255,0.18), rgba(0,0,0,0) 55%), radial-gradient(circle at 75% 80%, rgba(35,144,255,0.22), rgba(0,0,0,0) 55%)',
  filter: 'blur(10px)',
  opacity: 0.9,
  pointerEvents: 'none',
}

const lightsBottomStyle: React.CSSProperties = {
  position: 'absolute',
  left: -80,
  right: -80,
  bottom: -120,
  height: 200,
  background:
    'radial-gradient(circle at 25% 20%, rgba(35,144,255,0.18), rgba(0,0,0,0) 55%), radial-gradient(circle at 78% 30%, rgba(255,255,255,0.14), rgba(0,0,0,0) 60%)',
  filter: 'blur(12px)',
  opacity: 0.95,
  pointerEvents: 'none',
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
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--drift), 120vh, 0) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
