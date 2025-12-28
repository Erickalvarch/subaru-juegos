'use client'

import { useEffect, useMemo, useState } from 'react'

type ReleaseRow = {
  campaign_id: string
  is_enabled: boolean
  remaining_spins: number | null
  updated_at?: string | null
}

export default function AdminPage() {
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [release, setRelease] = useState<ReleaseRow | null>(null)
  const [counts, setCounts] = useState<any>(null)
  const [todayChile, setTodayChile] = useState<string>('')

  const [remaining, setRemaining] = useState<number>(10)

  const canAuth = useMemo(() => pin.trim().length >= 4, [pin])

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
      setRelease(data.release)
      setCounts(data.counts)
      setTodayChile(data.todayChile)
      setRemaining(data.release?.remaining_spins ?? 10)
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

  // auto-refresh cada 10s cuando está logeado
  //useEffect(() => {
   // if (!authed) return
    //const t = setInterval(() => {
    //  fetchStatus()
    //}, 10000)
    //return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, letterSpacing: 1, opacity: 0.9 }}>SUBARU • PANEL STAFF</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Control de mochilas (ventana) + conteos del día.
          </div>
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
            <button
              style={btnPrimary(canAuth && !loading)}
              disabled={!canAuth || loading}
              onClick={fetchStatus}
            >
              {loading ? 'Cargando…' : 'Entrar'}
            </button>
            {err && <div style={errStyle}>⚠️ {err}</div>}
          </div>
        )}

        {authed && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={sectionStyle}>
              <div style={hStyle}>Estado hoy (Chile) {todayChile ? `• ${todayChile}` : ''}</div>
              <div style={grid3}>
                <Stat label="Mochilas hoy" value={counts?.BACKPACK ?? '-'} />
                <Stat label="Aguas hoy" value={counts?.WATER ?? '-'} />
                <Stat label="Jugadas hoy" value={counts?.TOTAL ?? '-'} />
              </div>
              <div style={grid3}>
                <Stat label="Ruleta" value={counts?.WHEEL ?? '-'} />
                <Stat label="Tragamonedas" value={counts?.SLOTS ?? '-'} />
                <Stat label="Sigue" value={counts?.TRY_AGAIN ?? '-'} />
              </div>
              <button style={btnGhost(!loading)} disabled={loading} onClick={fetchStatus}>
                🔄 Actualizar
              </button>
            </div>

            <div style={sectionStyle}>
              <div style={hStyle}>Ventana Mochila (forzar dentro de N jugadas válidas)</div>

              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ opacity: 0.85 }}>
                    Estado actual:{' '}
                    <b>
                      {release?.is_enabled ? 'ACTIVA' : 'INACTIVA'}
                    </b>
                    {' • '}
                    Restantes:{' '}
                    <b>{release?.remaining_spins ?? '-'}</b>
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
                  <button
                    style={btnWarn(!loading)}
                    disabled={loading}
                    onClick={() => setReleaseWindow(false, 0)}
                  >
                    ⛔ Desactivar / Cancelar
                  </button>

                  <button
                    style={btnGhost(!loading)}
                    disabled={loading}
                    onClick={() => setReleaseWindow(true, 10)}
                  >
                    ⚡ Activar “rápido” (10)
                  </button>
                </div>

                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  * Cuenta solo jugadas válidas registradas. Cuando se entrega Mochila, la ventana se cierra automáticamente (según la lógica del backend).
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
