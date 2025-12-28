import Link from 'next/link'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 18,
      background: '#000',
      color: '#fff'
    }}>
      <div style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <h1 style={{ marginBottom: 18 }}>Subaru - Juegos</h1>

        <div style={{ display: 'grid', gap: 12 }}>
          <Link href="/play" style={btn}>🎡 Ruleta (Móvil)</Link>
          <Link href="/slots" style={btn}>🎰 Tragamonedas (Notebook)</Link>
          <Link href="/admin" style={btn2}>🧑‍💼 Panel Staff</Link>
        </div>

        <p style={{ marginTop: 16, opacity: 0.7, fontSize: 12 }}>
          Stand Subaru • 8 al 17 de enero • 1 participación por persona
        </p>
      </div>
    </main>
  )
}

const btn: React.CSSProperties = {
  display: 'block',
  padding: 16,
  borderRadius: 14,
  textDecoration: 'none',
  color: '#fff',
  fontWeight: 900,
  background: 'linear-gradient(180deg, #1E88E5 0%, #0B3D91 100%)',
  border: '1px solid rgba(255,255,255,0.18)',
}

const btn2: React.CSSProperties = {
  ...btn,
  background: 'rgba(255,255,255,0.10)',
}
