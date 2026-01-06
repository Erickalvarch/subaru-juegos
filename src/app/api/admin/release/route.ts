import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID
const ADMIN_PIN = process.env.ADMIN_PIN

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // 🔐 Validación PIN (robusta)
    const reqPin = String(body?.pin ?? '').trim()
    const envPin = String(ADMIN_PIN ?? '').trim()

    if (!envPin || reqPin !== envPin) {
      return NextResponse.json({ error: 'PIN inválido' }, { status: 401 })
    }

    if (!CAMPAIGN_ID) {
      return NextResponse.json({ error: 'Falta NEXT_PUBLIC_CAMPAIGN_ID' }, { status: 500 })
    }

    const enable = Boolean(body?.enable)
    const remainingRaw = body?.remainingSpins
    const remaining =
      enable
        ? Math.max(1, Math.min(200, Number(remainingRaw ?? 10)))
        : 0

    // 🔄 Update directo (NO game_type)
    const { error } = await supabaseAdmin
      .from('release_window')
      .update({
        is_enabled: enable,
        remaining_spins: remaining,
        updated_at: new Date().toISOString(),
      })
      .eq('campaign_id', CAMPAIGN_ID)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 })
  }
}
