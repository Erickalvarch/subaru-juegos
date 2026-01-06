import Link from 'next/link'

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 18,
        background: '#000',
        color: '#fff',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <h1 style={{ marginBottom: 18 }}>Subaru – Juegos</h1>

        <div style={{ display: 'grid', gap: 12 }}>
          {/* Ruleta móvil */}
          <Link href="/ruleta" style={btnPrimary}>
            🎡 Ruleta (Móvil)
          </Link>

          {/* Registro Tómbola */}
          <Link href="/registro" style={btnPrimary}>
            📝 Registro para jugar Tómbola
          </Link>

          {/* Tómbola stand (uso interno) */}
          <Link href="/slots" style={btnSecondary}>
            🎰 Tómbola (Stand)
          </Link>

          {/* Panel staff */}
          <Link href="/admin" style={btnGhost}>
            🧑‍💼 Panel Staff
          </Link>
        </div>

        <p style={{ marginTop: 18, opacity: 0.7, fontSize: 12 }}>
          Stand Subaru • 8 al 17 de enero <br />
          Ruleta: 1 participación por persona <br />
          Tómbola: registro obligatorio
        </p>
      </div>
    </main>
  )
}

/* ====== estilos ====== */

const btnBase: React.CSSProperties = {
  display: 'block',
  padding: 16,
  borderRadius: 16,
  textDecoration: 'none',
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  border: '1px solid rgba(255,255,255,0.18)',
}

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  color: '#fff',
  background: 'linear-gradient(180deg, #1E88E5 0%, #0B3D91 100%)',
  boxShadow: '0 10px 30px rgba(30,136,229,0.35)',
}

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  color: '#fff',
  background: 'rgba(255,255,255,0.10)',
}

const btnGhost: React.CSSProperties = {
  ...btnBase,
  color: '#fff',
  background: 'rgba(255,255,255,0.05)',
}
