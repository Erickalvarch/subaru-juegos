'use client'

import { useState } from 'react'
import Image from 'next/image'

type Resp =
  | { ok: true; code: string }
  | { ok: false; error: string; alreadyRegistered?: boolean; code?: string | null }

export default function RegistroPage() {
  const [form, setForm] = useState({
    name: '',
    rut: '',
    phone: '',
    email: '',
    comuna: '',
    modelPreference: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v })
  }

  async function submit() {
    setError(null)

    if (!form.name || !form.rut || !form.phone || !form.email) {
      setError('Completa los campos obligatorios.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          gameType: 'tombola',
        }),
      })

      const data: Resp = await res.json()

      if (!res.ok || data.ok !== true) {
  const msg =
    (data.ok === false ? data.error : null) ??
    'No fue posible completar el registro. Intenta nuevamente.'
  setError(msg)
  return
}


      setCode(data.code)
    } catch (e: any) {
      setError(e?.message || 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  // 👉 Pantalla FINAL: muestra el código
  if (code) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <Image
            src="/assets/logo-subaru_blanco.png"
            alt="Subaru"
            width={120}
            height={120}
            priority
          />

          <h1 style={{ fontSize: 28, marginTop: 12 }}>¡Registro exitoso!</h1>

          <p style={{ opacity: 0.85, marginTop: 6 }}>
            Guarda este código y preséntalo en la tómbola del stand
          </p>

          <div style={codeBox}>{code}</div>

          <p style={{ fontSize: 14, opacity: 0.75 }}>
            * El código se puede usar <b>una sola vez</b>
          </p>
        </div>
      </div>
    )
  }

  // 👉 Formulario
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <Image
          src="/assets/logo-subaru_blanco.png"
          alt="Subaru"
          width={120}
          height={120}
          priority
        />

        <h1 style={{ fontSize: 26, marginTop: 10 }}>
          Registro Tómbola Subaru
        </h1>

        <p style={{ opacity: 0.85, marginBottom: 14 }}>
          Completa tus datos para obtener tu código
        </p>

        <div style={gridStyle}>
          <input
            style={input}
            placeholder="Nombre *"
            value={form.name}
            onChange={e => update('name', e.target.value)}
          />

          <input
            style={input}
            placeholder="RUT *"
            value={form.rut}
            onChange={e => update('rut', e.target.value)}
          />

          <input
            style={input}
            placeholder="Teléfono *"
            value={form.phone}
            onChange={e => update('phone', e.target.value)}
          />

          <input
            style={input}
            placeholder="Email *"
            value={form.email}
            onChange={e => update('email', e.target.value)}
          />

          <input
            style={input}
            placeholder="Comuna"
            value={form.comuna}
            onChange={e => update('comuna', e.target.value)}
          />

          <input
            style={input}
            placeholder="Modelo de preferencia"
            value={form.modelPreference}
            onChange={e => update('modelPreference', e.target.value)}
          />
        </div>

        {error && (
          <div style={{ color: '#ff6b6b', marginBottom: 10 }}>
            {error}
          </div>
        )}

        <button onClick={submit} disabled={loading} style={buttonStyle}>
          {loading ? 'Registrando…' : 'Registrarme'}
        </button>

        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
          * Un registro por persona · Premios sujetos a stock
        </p>
      </div>
    </div>
  )
}

/* ====== estilos ====== */

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: `
    radial-gradient(circle at 20% 10%, rgba(30,136,229,0.28), rgba(0,0,0,0) 45%),
    linear-gradient(rgba(0,0,0,.7), rgba(0,0,0,.9)),
    url(/assets/fondo2.jpg)
  `,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  padding: 16,
  color: '#fff',
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  background: 'rgba(10,10,10,0.65)',
  borderRadius: 22,
  padding: 22,
  textAlign: 'center',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 18px 70px rgba(0,0,0,0.6)',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 10,
  marginBottom: 12,
}

const input: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  outline: 'none',
  fontSize: 15,
}

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 18px',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.18)',
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: 'uppercase',
  background: 'linear-gradient(180deg, #1E88E5 0%, #0B3D91 100%)',
  color: '#fff',
  cursor: 'pointer',
}

const codeBox: React.CSSProperties = {
  marginTop: 16,
  marginBottom: 10,
  fontSize: 42,
  fontWeight: 900,
  letterSpacing: 6,
  padding: '14px 18px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.18)',
}
