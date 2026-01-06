import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const codeRaw = String(body?.code ?? '').trim()

    // acepta 1 a 4 dígitos
    if (!/^\d{1,4}$/.test(codeRaw)) {
      return NextResponse.json(
        { ok: false, error: 'Código inválido.' },
        { status: 400 }
      )
    }

    const code = codeRaw.padStart(4, '0')

    // Buscar registro de tómbola
    const { data: reg, error: regErr } = await supabaseAdmin
      .from('registrations')
      .select('id, name, email, code, used')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('game_type', 'tombola')
      .eq('code', code)
      .maybeSingle()

    if (regErr) throw regErr

    if (!reg) {
      return NextResponse.json(
        { ok: false, error: 'Código no encontrado.' },
        { status: 404 }
      )
    }

    if (reg.used) {
      return NextResponse.json(
        { ok: false, error: 'Este código ya fue usado.' },
        { status: 409 }
      )
    }

    // SOLO valida, NO canjea
    return NextResponse.json({
      ok: true,
      code,
      registration: {
        id: reg.id,
        name: reg.name,
        email: reg.email,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Error inesperado' },
      { status: 500 }
    )
  }
}
