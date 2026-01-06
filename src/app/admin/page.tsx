'use client'

import React, { useEffect, useMemo, useState } from 'react'

type ReleaseRow = {
  campaign_id: string
  is_enabled: boolean
  remaining_spins: number | null
  updated_at?: string | null
}

type Counts = Record<string, number>

export default function AdminPage() {
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [release, setRelease] = useState<ReleaseRow | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [todayChile, setTodayChile] = useState<string>('')

  const [remaining, setRemaining] = useState<number>(10)

  const canAuth = useMemo(() => pin.trim().length >= 4, [pin])

  function c(key: string, fallback = 0) {
    const v = counts?.[key]
    return typeof v === 'number' ? v : fallback
  }

  async function fetchStatus() {
    setLoading(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? 'Error status')

      setAuthed(true)
      setRelease(data.release ?? null)
      setCounts(data.counts ?? null)
      setTodayChile(data.todayChile ?? '')
      setRemaining((data.release?.remaining_spins ?? 10) as number)
    } catch (e: any) {
      setErr(e?.message ?? 'Error')
      setAuthed(false)
    } finally {
      setLoading(false)
    }
  }

  async function setReleaseWindow(enable: boolean, remainingSpins?: number) {
    setLoading(true)
    setErr(null)
    setMsg(null)
    try {
      const payload: any = { pin, enable }
      if (typeof remainingSpins === 'number') payload.remainingSpins = remainingSpins

      const r = await fetch('/api/admin/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? 'Error release')

      setMsg(enable ? '✅ Ventana de Mochila ACTIVADA' : '⛔ Ventana de Mochila DESACTIVADA')
      await fetchStatus()
    } catch (e: any) {
      setErr(e?.message ?? 'Error')
    } finally {
      setLoading(false)
    }
  }

  // Compat: si backend aún devuelve SLOTS, lo tratamos como TOMBOLA
  const tombolaCount = c('TOMBOLA', c('SLOTS', 0))
  const wheelCount = c('WHEEL', 0)

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, letterSpacing: 1, opacity: 0.9 }}>SUBARU • PANEL STAFF</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Control de mochilas (ventana) + conteos del día.</div>
        </div>

        {!authed && (
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              style={inputStyle}
              placeholder="PIN staff"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
            />
            <button style={btnPrimary(canAuth && !loading)} disabled={!canAuth || loading} onClick={fetchStatus}>
              {loading ? 'Cargando…' : 'Entrar'}
            </button>
            {err && <div style={errStyle}>⚠️ {err}</div>}
          </div>
        )}

        {authed && (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* RESUMEN COMPLETO */}
            <div style={sectionStyle}>
              <div style={hStyle}>Estado hoy (Chile) {todayChile ? `• ${todayChile}` : ''}</div>

              {/* Totales */}
              <div style={grid3}>
                <Stat label="Jugadas hoy" value={c('TOTAL', 0)} />
                <Stat label="Ruleta" value={wheelCount} />
                <Stat label="Tómbola" value={tombolaCount} />
              </div>

              {/* Premios globales */}
              <div style={grid3}>
                <Stat label="Mochilas" value={c('BACKPACK', 0)} />
                <Stat label="Aguas" value={c('WATER', 0)} />
                <Stat label="Lanyard" value={c('LANYARD', 0)} />
              </div>
              <div style={grid3}>
                <Stat label="Buff" value={c('BUFF', 0)} />
                <Stat label="Manta" value={c('BLANKET', 0)} />
                <Stat label="Sigue" value={c('TRY_AGAIN', 0)} />
              </div>

              <button style={btnGhost(!loading)} disabled={loading} onClick={fetchStatus}>
                🔄 Actualizar
              </button>
            </div>

            {/* Probabilidades editables */}
            <PrizeWeightsEditor pin={pin} />

            {/* Ventana Mochila */}
            <div style={sectionStyle}>
              <div style={hStyle}>Ventana Mochila (forzar dentro de N jugadas válidas)</div>

              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ opacity: 0.85 }}>
                    Estado actual: <b>{release?.is_enabled ? 'ACTIVA' : 'INACTIVA'}</b> {' • '}
                    Restantes: <b>{release?.remaining_spins ?? '-'}</b>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                  <input
                    style={inputStyle}
                    type="number"
                    min={1}
                    max={200}
                    value={remaining}
                    onChange={(e) => setRemaining(parseInt(e.target.value || '10', 10))}
                    disabled={loading}
                    placeholder="10"
                  />
                  <button
                    style={btnPrimary(!loading)}
                    disabled={loading}
                    onClick={() => setReleaseWindow(true, remaining)}
                  >
                    🎒 Activar en próximas {remaining || 10} jugadas
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button style={btnWarn(!loading)} disabled={loading} onClick={() => setReleaseWindow(false, 0)}>
                    ⛔ Desactivar / Cancelar
                  </button>

                  <button style={btnGhost(!loading)} disabled={loading} onClick={() => setReleaseWindow(true, 10)}>
                    ⚡ Activar “rápido” (10)
                  </button>
                </div>

                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  * BACKPACK (Mochila) en Tómbola solo puede salir cuando esta ventana está ACTIVA.
                  <br />
                  Cuando se entrega una Mochila, la ventana se cierra automáticamente (según la lógica del backend).
                </div>

                {msg && <div style={okStyle}>{msg}</div>}
                {err && <div style={errStyle}>⚠️ {err}</div>}
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.65, textAlign: 'center' }}>
              Seguridad: comparte este panel solo con staff. Cambia ADMIN_PIN en Vercel si es necesario.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 18,
  background: 'linear-gradient(180deg, #05070B, #0B1220)',
  color: '#fff',
}

const cardStyle: React.CSSProperties = {
  width: 'min(920px, 100%)',
  borderRadius: 18,
  padding: 18,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 18px 70px rgba(0,0,0,0.55)',
}

const sectionStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: 14,
  background: 'rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.10)',
  display: 'grid',
  gap: 10,
}

const hStyle: React.CSSProperties = {
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.9,
}

const grid3: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 10,
}

const statCard: React.CSSProperties = {
  borderRadius: 14,
  padding: 12,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
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

function btnPrimary(enabled: boolean): React.CSSProperties {
  return {
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.18)',
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    background: enabled ? 'linear-gradient(180deg, #1E88E5 0%, #0B3D91 100%)' : 'rgba(255,255,255,0.12)',
    color: '#fff',
    opacity: enabled ? 1 : 0.6,
    cursor: enabled ? 'pointer' : 'not-allowed',
  }
}

function btnWarn(enabled: boolean): React.CSSProperties {
  return {
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.18)',
    fontWeight: 900,
    background: enabled ? 'rgba(255, 60, 90, 0.20)' : 'rgba(255,255,255,0.12)',
    color: '#fff',
    opacity: enabled ? 1 : 0.6,
    cursor: enabled ? 'pointer' : 'not-allowed',
  }
}

function btnGhost(enabled: boolean): React.CSSProperties {
  return {
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.14)',
    fontWeight: 800,
    background: enabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
    color: '#fff',
    opacity: enabled ? 1 : 0.6,
    cursor: enabled ? 'pointer' : 'not-allowed',
  }
}

const okStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: 'rgba(30,136,229,0.16)',
  border: '1px solid rgba(30,136,229,0.35)',
  fontWeight: 800,
}

const errStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: 'rgba(255, 60, 90, 0.16)',
  border: '1px solid rgba(255, 60, 90, 0.35)',
  fontWeight: 800,
}

/** Editor de probabilidades */
function PrizeWeightsEditor({ pin }: { pin: string }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // OJO: aquí usamos tombola (NO slots)
  type Row = { game_type: 'wheel' | 'tombola'; prize_key: string; weight: number }
  const [rows, setRows] = useState<Row[]>([])

  // Tu definición actual de premios
  const wheelKeys = ['BUFF', 'LANYARD', 'BLANKET', 'TRY_AGAIN']
  const tombolaKeys = ['BUFF', 'BACKPACK', 'WATER', 'LANYARD', 'TRY_AGAIN']

  async function load() {
    setLoading(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/prize-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, action: 'get' }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? 'Error')

      const map = new Map<string, number>()
      for (const it of data.items ?? []) {
        map.set(`${it.game_type}:${it.prize_key}`, Number(it.weight || 0))
      }

      const merged: Row[] = []
      for (const k of wheelKeys) merged.push({ game_type: 'wheel', prize_key: k, weight: map.get(`wheel:${k}`) ?? 0 })
      for (const k of tombolaKeys)
        merged.push({ game_type: 'tombola', prize_key: k, weight: map.get(`tombola:${k}`) ?? 0 })

      setRows(merged)
    } catch (e: any) {
      setErr(e?.message ?? 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setLoading(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/prize-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, action: 'save', items: rows }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error ?? 'Error')
      setMsg('✅ Probabilidades guardadas')
    } catch (e: any) {
      setErr(e?.message ?? 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wheelSum = rows.filter((r) => r.game_type === 'wheel').reduce((s, r) => s + (Number(r.weight) || 0), 0)
  const tombolaSum = rows.filter((r) => r.game_type === 'tombola').reduce((s, r) => s + (Number(r.weight) || 0), 0)

  function setWeight(game_type: 'wheel' | 'tombola', prize_key: string, value: number) {
    setRows((prev) =>
      prev.map((r) => (r.game_type === game_type && r.prize_key === prize_key ? { ...r, weight: value } : r))
    )
  }

  return (
    <div style={sectionStyle}>
      <div style={hStyle}>Probabilidades (editables)</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Se guardan como “pesos”. Puedes tratarlos como % si haces que sumen 100.
        <br />
        * 🎒 BACKPACK (Mochila) solo se entrega en Tómbola cuando la ventana está ACTIVADA.
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 900, opacity: 0.9 }}>🎡 Ruleta (wheel) • Suma: {wheelSum}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
            {wheelKeys.map((k) => {
              const row = rows.find((r) => r.game_type === 'wheel' && r.prize_key === k)!
              return (
                <div key={`wheel-${k}`} style={{ display: 'contents' }}>
                  <div style={{ opacity: 0.9, padding: '10px 0' }}>{k}</div>
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    value={row?.weight ?? 0}
                    onChange={(e) => setWeight('wheel', k, Number(e.target.value || 0))}
                    disabled={loading}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 900, opacity: 0.9 }}>🎰 Tómbola (tombola) • Suma: {tombolaSum}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
            {tombolaKeys.map((k) => {
              const row = rows.find((r) => r.game_type === 'tombola' && r.prize_key === k)!
              return (
                <div key={`tombola-${k}`} style={{ display: 'contents' }}>
                  <div style={{ opacity: 0.9, padding: '10px 0' }}>{k}</div>
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    value={row?.weight ?? 0}
                    onChange={(e) => setWeight('tombola', k, Number(e.target.value || 0))}
                    disabled={loading}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnGhost(!loading)} disabled={loading} onClick={load}>
            🔄 Recargar
          </button>
          <button style={btnPrimary(!loading)} disabled={loading} onClick={save}>
            💾 Guardar
          </button>
        </div>

        {msg && <div style={okStyle}>{msg}</div>}
        {err && <div style={errStyle}>⚠️ {err}</div>}
      </div>
    </div>
  )
}
