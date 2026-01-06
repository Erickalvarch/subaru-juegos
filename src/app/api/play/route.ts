import { NextResponse } from 'next/server'
import { playGame } from '@/lib/playGame'

type GameType = 'wheel' | 'slots'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim()
    const gameType = String(body?.gameType ?? '').trim() as GameType

    if (!name) return NextResponse.json({ ok: false, error: 'Falta name' }, { status: 400 })
    if (!email) return NextResponse.json({ ok: false, error: 'Falta email' }, { status: 400 })

    // BLOQUEO CLAVE: si llega "tombola", falla fuerte y no registra nada
    if (!['wheel', 'slots'].includes(gameType)) {
      return NextResponse.json(
        { ok: false, error: 'gameType inválido para este endpoint' },
        { status: 400 }
      )
    }

    const data = await playGame({ name, email, gameType })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Error inesperado' }, { status: 500 })
  }
}
