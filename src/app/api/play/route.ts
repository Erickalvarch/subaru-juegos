import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!

type GameType = 'wheel' | 'slots'
type PrizeKey = 'BACKPACK' | 'WATER' | 'LANYARD' | 'BLANKET' | 'TRY_AGAIN'

function pickWeighted(items: Array<{ prize_key: PrizeKey; weight: number }>): PrizeKey {
  const list = items.filter(i => i.weight > 0)
  const total = list.reduce((s, i) => s + i.weight, 0)
  if (total <= 0) return 'TRY_AGAIN'
  let r = Math.random() * total
  for (const i of list) {
    r -= i.weight
    if (r <= 0) return i.prize_key
  }
  return list[list.length - 1].prize_key
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, gameType } = body as { name: string; email: string; gameType?: string }

    const cleanEmail = (email || '').toLowerCase().trim()
    const cleanName = (name || '').trim()

    const gt: GameType = gameType === 'slots' ? 'slots' : 'wheel'

    // 1) Validar campaña activa
    const { data: campaign, error: campErr } = await supabase
      .from('campaign')
      .select('*')
      .eq('id', CAMPAIGN_ID)
      .single()

    if (campErr || !campaign) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
    }

    const now = new Date()
    if (!campaign.is_active || now < new Date(campaign.start_at) || now > new Date(campaign.end_at)) {
      return NextResponse.json({ error: 'Campaña no activa' }, { status: 403 })
    }

    // 2) Insertar jugador (1 por campaña)
    const { data: existingPlayer, error: existErr } = await supabase
      .from('players')
      .select('id')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 })

    if (!existingPlayer) {
      const { error: insErr } = await supabase.from('players').insert({
        campaign_id: CAMPAIGN_ID,
        name: cleanName,
        email: cleanEmail,
      })
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    // 3) Leer release_window (para “forzar mochila dentro de N jugadas”)
    const { data: releaseRow, error: relErr } = await supabase
      .from('release_window')
      .select('*')
      .eq('campaign_id', CAMPAIGN_ID)
      .maybeSingle()

    if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 })

    // 4) Leer probabilidades para este juego
    const { data: weights, error: wErr } = await supabase
      .from('prize_weights')
      .select('prize_key, weight')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('game_type', gt)

    if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })

    // Lista permitida por juego (manta solo en ruleta)
    const allowed: PrizeKey[] = gt === 'wheel'
      ? ['BACKPACK', 'WATER', 'LANYARD', 'BLANKET', 'TRY_AGAIN']
      : ['BACKPACK', 'WATER', 'LANYARD', 'TRY_AGAIN']

    const normalized = (weights || [])
      .map((r: any) => ({ prize_key: r.prize_key as PrizeKey, weight: Number(r.weight || 0) }))
      .filter(r => allowed.includes(r.prize_key))

    // 5) Determinar premio
    let result: PrizeKey = 'TRY_AGAIN'

    // Si está activa la ventana de mochila:
    if (releaseRow?.is_enabled && (releaseRow.remaining_spins ?? 0) > 0) {
      const remaining = Number(releaseRow.remaining_spins)

      // Se cuenta esta jugada como válida
      if (remaining <= 1) {
        result = 'BACKPACK'
        // cerrar ventana
        await supabase.from('release_window').update({
          is_enabled: false,
          remaining_spins: 0,
          updated_at: new Date().toISOString(),
        }).eq('campaign_id', CAMPAIGN_ID)
      } else {
        // decrementa y en esta jugada NO fuerza mochila (se fuerza al final del conteo)
        await supabase.from('release_window').update({
          remaining_spins: remaining - 1,
          updated_at: new Date().toISOString(),
        }).eq('campaign_id', CAMPAIGN_ID)

        // sorteamos excluyendo BACKPACK (para que sea “controlado”)
        const noBackpack = normalized.filter(n => n.prize_key !== 'BACKPACK')
        result = pickWeighted(noBackpack.length ? noBackpack : [{ prize_key: 'TRY_AGAIN', weight: 1 }])
      }
    } else {
      // sorteo normal
      result = pickWeighted(normalized.length ? normalized : [{ prize_key: 'TRY_AGAIN', weight: 1 }])
    }

    // 6) Registrar jugada
    const { error: playErr } = await supabase.from('plays').insert({
      campaign_id: CAMPAIGN_ID,
      email: cleanEmail,
      name: cleanName,
      game_type: gt,
      result,
    })

    if (playErr) return NextResponse.json({ error: playErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 })
  }
}
