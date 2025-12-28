import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const ADMIN_PIN = process.env.ADMIN_PIN || ''
const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { pin, action, items } = body as any

    if (!ADMIN_PIN || pin !== ADMIN_PIN) {
      return NextResponse.json({ error: 'PIN inválido' }, { status: 401 })
    }

    if (action === 'get') {
      const { data, error } = await supabase
        .from('prize_weights')
        .select('game_type, prize_key, weight')
        .eq('campaign_id', CAMPAIGN_ID)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, items: data ?? [] })
    }

    if (action === 'save') {
      if (!Array.isArray(items)) {
        return NextResponse.json({ error: 'items inválido' }, { status: 400 })
      }

      // upsert por unique(campaign_id, game_type, prize_key)
      const payload = items.map((it: any) => ({
        campaign_id: CAMPAIGN_ID,
        game_type: it.game_type,
        prize_key: it.prize_key,
        weight: Number(it.weight || 0),
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('prize_weights')
        .upsert(payload, { onConflict: 'campaign_id,game_type,prize_key' })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 })
  }
}
