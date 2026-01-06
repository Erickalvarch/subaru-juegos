import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!

type GameType = 'wheel' | 'tombola'

function random4Digits() {
  const n = Math.floor(Math.random() * 10000)
  return String(n).padStart(4, '0')
}

async function generateUniqueTombolaCode(): Promise<string> {
  for (let i = 0; i < 80; i++) {
    const code = random4Digits()
    const { data, error } = await supabaseAdmin
      .from('registrations')
      .select('id')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('game_type', 'tombola')
      .eq('code', code)
      .maybeSingle()

    if (error) throw error
    if (!data) return code
  }
  throw new Error('No fue posible generar un código único de 4 dígitos.')
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const gameType: GameType = body?.gameType === 'tombola' ? 'tombola' : 'wheel'

    const name = String(body?.name ?? '').trim()
    const rut = String(body?.rut ?? '').trim()
    const phone = String(body?.phone ?? '').trim()
    const email = String(body?.email ?? '').trim().toLowerCase() // ✅ normalizado
    const comuna = String(body?.comuna ?? '').trim()
    const modelPreference = String(body?.modelPreference ?? '').trim()

    if (!name || !rut || !phone || !email || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Faltan campos obligatorios o email inválido.' }, { status: 400 })
    }

    // 1) Regla: 1 registro por email por juego (usa 'email' normalizado)
    const { data: exists, error: existsErr } = await supabaseAdmin
      .from('registrations')
      .select('id, code')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('game_type', gameType)
      .eq('email', email)
      .maybeSingle()

    if (existsErr) throw existsErr

    if (exists) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Este email ya participó en este juego.',
          alreadyRegistered: true,
          code: exists.code ?? null,
        },
        { status: 409 }
      )
    }

    // 2) Genera código solo para tombola
    let code: string | null = null
    if (gameType === 'tombola') {
      code = await generateUniqueTombolaCode()
    }

    // 3) Inserta (con used=false explícito si existe columna)
    const insertPayload: any = {
      campaign_id: CAMPAIGN_ID,
      game_type: gameType,
      name,
      rut,
      phone,
      email, // ✅ guardamos en minúscula
      comuna: comuna || null,
      model_preference: modelPreference || null,
      code,
    }

    // Si tu tabla tiene used/used_at, esto ayuda a dejarlo consistente:
    insertPayload.used = false
    insertPayload.used_at = null

    const { data: reg, error: insErr } = await supabaseAdmin
      .from('registrations')
      .insert(insertPayload)
      .select('id, code')
      .single()

    if (insErr) {
      // Condición de carrera
      if (String(insErr.message || '').toLowerCase().includes('duplicate')) {
        return NextResponse.json(
          { ok: false, error: 'Este email ya participó en este juego.', alreadyRegistered: true },
          { status: 409 }
        )
      }
      throw insErr
    }

    return NextResponse.json({ ok: true, registrationId: reg.id, code: reg.code ?? null })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error inesperado' }, { status: 500 })
  }
}
