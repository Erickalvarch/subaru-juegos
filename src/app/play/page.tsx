'use client'

import React, { useMemo, useRef, useState } from 'react'
import Image from 'next/image'

type Prize = 'BACKPACK' | 'WATER' | 'LANYARD' | 'BLANKET' | 'TRY_AGAIN'

type ApiResp =
  | { ok: true; result: Prize }
  | { ok: false; reason: 'ALREADY_PLAYED'; message: string }
  | { ok: false; error: string }

const prizeLabels: Record<Prize, string> = {
  BACKPACK: 'Mochila',
  WATER: 'Agua',
  LANYARD: 'Lanyard',
  BLANKET: 'Manta',
  TRY_AGAIN: 'Sigue participando',
}

const SEGMENTS: Array<{
  key: Prize
  label: string
  iconSrc: string
  color: string
}> = [
  { key: 'BACKPACK', label: prizeLabels.BACKPACK, iconSrc: '/assets/icon-mochila.png', color: '#0B3D91' },
  { key: 'WATER', label: prizeLabels.WATER, iconSrc: '/assets/icon-agua.png', color: '#1E88E5' },
  { key: 'LANYARD', label: prizeLabels.LANYARD, iconSrc: '/assets/lanyard.png', color: '#145A9C' },
  { key: 'BLANKET', label: prizeLabels.BLANKET, iconSrc: '/assets/manta.png', color: '#1A1A1A' },
  { key: 'TRY_AGAIN', label: prizeLabels.TRY_AGAIN, iconSrc: '/assets/logo-subaru_blanco.png', color: '#2E2E2E' },
]

const SPIN_MS = 5200

// ✅ Ruleta (si cambias tamaño, todo se ajusta solo)
const WHEEL_SIZE = 340
const WHEEL_RADIUS = WHEEL_SIZE / 2
const ICON_RADIUS = WHEEL_RADIUS * 0.68 // 0.66–0.70 recomendado

export default function PlayPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [result, setResult] = useState<Prize | null>(null)

  const [rotation, setRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [glow, setGlow] = useState(false)
  const [confettiOn, setConfettiOn] = useState(false)

  const segmentAngle = 360 / SEGMENTS.length

  // ---- Tick sound (sin archivos) via WebAudio
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
    osc.frequency.value = 1200
    gain.gain.value = 0.08

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
    return name.trim().length > 1 && email.trim().includes('@') && !loading && !isSpinning
  }, [name, email, loading, isSpinning])

  function prizeToIndex(p: Prize) {
    return SEGMENTS.findIndex((s) => s.key === p)
  }

  function spinToPrize(p: Prize) {
    const idx = prizeToIndex(p)
    if (idx < 0) return

    // conic-gradient: 0° a la derecha; arriba = -90°
    const center = idx * segmentAngle + segmentAngle / 2
    const extraTurns = 5 + Math.floor(Math.random() * 3)
    const jitter = Math.random() * 10 - 5
    const targetDelta = -(center + 90) + jitter

    setRotation((prev) => prev + extraTurns * 360 + targetDelta)
  }

  async function play() {
    setLoading(true)
    setError(null)
    setInfo(null)
    setResult(null)
    setGlow(false)
    setIsSpinning(true)

    startTicks()

    try {
      const res = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, gameType: 'wheel' }),
      })

      const data: ApiResp = await res.json()

      // 🟡 Caso: ya participó (NO es error técnico)
      if (data.ok === false && 'reason' in data && data.reason === 'ALREADY_PLAYED') {
        setError(null)
        setInfo(data.message ?? 'Ya participaste en esta campaña. ¡Gracias por jugar!')
        setIsSpinning(false)
        stopTicks()
        return
      }

      // 🔴 Errores reales
      if (!res.ok || (data.ok === false && 'error' in data)) {
        setError('error' in data ? data.error : 'Error al procesar la jugada')
        setIsSpinning(false)
        stopTicks()
        return
      }

      // 🟢 Caso normal
      if (data.ok !== true) {
        setError('No llegó resultado desde el servidor')
        setIsSpinning(false)
        stopTicks()
        return
      }

      const prize = data.result

      spinToPrize(prize)

      window.setTimeout(() => {
        stopTicks()
        setResult(prize)
        setIsSpinning(false)

        if (prize === 'BACKPACK') {
          setGlow(true)
          window.setTimeout(() => setGlow(false), 2400)
        }

        if (prize !== 'TRY_AGAIN') {
          fireConfetti()
        }
      }, SPIN_MS)
    } catch (e: any) {
      stopTicks()
      setError(e?.message ?? 'Error de red')
      setIsSpinning(false)
    } finally {
      setLoading(false)
    }
  }

  const resultText = result ? prizeLabels[result] : null
  const resultEmoji =
    result === 'BACKPACK'
      ? '🎒'
      : result === 'WATER'
      ? '💧'
      : result === 'LANYARD'
      ? '🪪'
      : result === 'BLANKET'
      ? '🧣'
      : result === 'TRY_AGAIN'
      ? '🙌'
      : ''

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 18,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        backgroundImage: `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.75)), url(/assets/fondo2.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {confettiOn && <ConfettiOverlay />}

      <div
        style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 18,
          padding: 18,
          background: 'rgba(10,10,10,0.62)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
        }}
      >
        {/* Título */}
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8 }}>
          <Image
            src="/assets/titulo-evento2.png"
            alt="Título evento"
            width={420}
            height={120}
            priority
            style={{ height: 'auto', width: 'min(420px, 100%)' }}
          />
        </div>

        {/* Form */}
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            style={inputStyle}
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading || isSpinning}
          />
          <input
            style={inputStyle}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || isSpinning}
          />

          <button
            onClick={play}
            disabled={!canPlay}
            style={{
              padding: 16,
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
            }}
          >
            {isSpinning ? 'GIRANDO…' : 'GIRAR'}
          </button>

          <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.35, textAlign: 'center' }}>
            * 1 participación por persona durante la campaña. Premios sujetos a stock diario y disponibilidad del stand.
            Participación válida solo con registro completo. Bases disponibles en el stand.
          </div>
        </div>

        {/* Ruleta */}
        <div style={{ marginTop: 14, position: 'relative', display: 'grid', placeItems: 'center', padding: 8 }}>
          {/* Flecha */}
          <div
            style={{
              position: 'absolute',
              top: 4,
              width: 0,
              height: 0,
              borderLeft: '12px solid transparent',
              borderRight: '12px solid transparent',
              borderTop: '18px solid #fff',
              zIndex: 6,
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.6))',
            }}
          />

          {/* Glow */}
          {glow && (
            <div
              style={{
                position: 'absolute',
                width: 380,
                height: 380,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(30,136,229,0.55), rgba(30,136,229,0.08) 55%, rgba(0,0,0,0) 70%)',
                filter: 'blur(2px)',
                zIndex: 1,
                animation: 'pulse 0.8s ease-in-out infinite alternate',
              }}
            />
          )}

          <div
            style={{
              width: WHEEL_SIZE,
              height: WHEEL_SIZE,
              borderRadius: '50%',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 14px 50px rgba(0,0,0,0.6)',
              outline: '1px solid rgba(255,255,255,0.10)',
              outlineOffset: '-10px',
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.7, 0.1, 1)` : 'none',
              background: `conic-gradient(${SEGMENTS.map((s, i) => {
                const start = i * segmentAngle
                const end = (i + 1) * segmentAngle
                return `${s.color} ${start}deg ${end}deg`
              }).join(',')})`,
              backfaceVisibility: 'hidden',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* ✅ Iconos centrados proporcionalmente (sin adivinar px) */}
            {SEGMENTS.map((s, i) => {
              const angle = i * segmentAngle + segmentAngle / 2

              return (
                <div
                  key={s.key}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 0,
                    height: 0,
                    transform: `rotate(${angle}deg) translateY(-${ICON_RADIUS}px)`,
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                >
                  <div
                    style={{
                      transform: `translate(-50%, -50%) rotate(${-angle}deg)`,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Image
                      src={s.iconSrc}
                      alt=""
                      aria-hidden
                      width={56}
                      height={56}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.6))',
                      }}
                    />
                  </div>
                </div>
              )
            })}

            {/* Centro */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 102,
                height: 102,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.62)',
                border: '1px solid rgba(255,255,255,0.18)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 4,
              }}
            >
              <Image
                src="/assets/logo-subaru_blanco.png"
                alt="Subaru"
                width={78}
                height={78}
                style={{ width: 78, height: 78, objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>

        {/* Resultado / Info / Error */}
        {(resultText || error || info) && (
          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(30,136,229,0.12)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(10px)',
              textAlign: 'center',
            }}
          >
            {result && (
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                {resultEmoji} {result === 'TRY_AGAIN' ? resultText : `¡Ganaste ${resultText}!`}
              </div>
            )}

            {info && (
              <div
                style={{
                  marginTop: result ? 10 : 0,
                  fontSize: 16,
                  fontWeight: 900,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(11,61,145,0.35)',
                  border: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                ✅ {info}
              </div>
            )}

            {error && (
              <div style={{ marginTop: 8 }}>
                <b>Error:</b> {error}
              </div>
            )}
          </div>
        )}

        <style jsx>{`
          @keyframes pulse {
            from {
              transform: scale(0.98);
              opacity: 0.8;
            }
            to {
              transform: scale(1.03);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  outline: 'none',
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
            }}
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
