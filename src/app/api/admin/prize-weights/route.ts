import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!
const ADMIN_PIN = process.env.ADMIN_PIN!

type Row = { game_type: 'wheel' | 'tombola'; prize_key: string; weight: number }

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { pin, action } = body

    if (!ADMIN_PIN || String(pin || '').trim() !== String(ADMIN_PIN).trim()) {
      return NextResponse.json({ error: 'PIN inválido' }, { status: 401 })
    }
    if (!CAMPAIGN_ID) return NextResponse.json({ error: 'Falta NEXT_PUBLIC_CAMPAIGN_ID' }, { status: 500 })

    if (action === 'get') {
      const { data, error } = await supabaseAdmin
        .from('prize_weights')
        .select('game_type, prize_key, weight')
        .eq('campaign_id', CAMPAIGN_ID)

      if (error) throw error
      return NextResponse.json({ ok: true, items: data ?? [] })
    }

    if (action === 'save') {
      const itemsRaw = body.items ?? []
      if (!Array.isArray(itemsRaw)) return NextResponse.json({ error: 'items inválido' }, { status: 400 })

      // ✅ Validación por juego (definición final)
      const allowedWheel = new Set(['BUFF', 'LANYARD', 'BLANKET', 'TRY_AGAIN'])
      const allowedTombola = new Set(['BUFF', 'BACKPACK', 'WATER', 'LANYARD', 'TRY_AGAIN'])

      // Normalizamos entradas
      const items: Row[] = itemsRaw.map((it: any) => ({
        game_type: String(it?.game_type ?? '').trim() as any,
        prize_key: String(it?.prize_key ?? '').trim().toUpperCase(),
        weight: typeof it?.weight === 'string' ? Number(it.weight) : Number(it?.weight),
      }))

      for (const it of items) {
        if (it.game_type !== 'wheel' && it.game_type !== 'tombola') {
          return NextResponse.json({ error: `game_type inválido: ${it.game_type}` }, { status: 400 })
        }
        if (!Number.isFinite(it.weight) || it.weight < 0) {
          return NextResponse.json({ error: `weight inválido (${it.game_type}:${it.prize_key})` }, { status: 400 })
        }

        if (it.game_type === 'wheel' && !allowedWheel.has(it.prize_key)) {
          return NextResponse.json({ error: `prize_key inválido wheel: ${it.prize_key}` }, { status: 400 })
        }
        if (it.game_type === 'tombola' && !allowedTombola.has(it.prize_key)) {
          return NextResponse.json({ error: `prize_key inválido tombola: ${it.prize_key}` }, { status: 400 })
        }
      }

      // Upsert por (campaign_id, game_type, prize_key)
      const upserts = items.map((it) => ({
        campaign_id: CAMPAIGN_ID,
        game_type: it.game_type,
        prize_key: it.prize_key,
        weight: it.weight,
      }))

      const { error } = await supabaseAdmin
        .from('prize_weights')
        .upsert(upserts, { onConflict: 'campaign_id,game_type,prize_key' })

      if (error) throw error

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'action inválida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 })
  }
}
