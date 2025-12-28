import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!

export async function POST(req: Request) {
  const body = await req.json()
  const { name, email, gameType } = body

  const cleanEmail = String(email ?? '').toLowerCase().trim()
  const cleanName = String(name ?? '').trim()
  const gt = gameType === 'slots' ? 'slots' : 'wheel'

  if (!cleanName || !cleanEmail) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // 1) Validar campaña activa
  const { data: campaign } = await supabase
    .from('campaign')
    .select('*')
    .eq('id', CAMPAIGN_ID)
    .single()

  const now = new Date()
  if (!campaign || !campaign.is_active || now < new Date(campaign.start_at) || now > new Date(campaign.end_at)) {
    return NextResponse.json({ error: 'Campaña no activa' }, { status: 403 })
  }

  // 2) Insertar jugador (1 por campaña)
  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert({
      campaign_id: CAMPAIGN_ID,
      name: cleanName,
      email: cleanEmail,
    })
    .select()
    .single()

  if (playerError || !player) {
    return NextResponse.json({ error: 'Ya participaste en esta campaña' }, { status: 409 })
  }

  // 3) Crear jugada válida
  await supabase.from('plays').insert({
    campaign_id: CAMPAIGN_ID,
    player_id: player.id,
    game_type: gt,
  })

  // 4) Stock diario
  const today = new Date().toISOString().split('T')[0]
  const { data: stock } = await supabase.rpc('get_or_create_daily_stock', {
    p_campaign_id: CAMPAIGN_ID,
    p_date: today,
  })

  // 5) Ventana de liberación
  const { data: release } = await supabase
    .from('release_window')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .single()

  let result: 'BACKPACK' | 'WATER' | 'TRY_AGAIN' = 'TRY_AGAIN'

  // 6) Mochila garantizada dentro de 10 jugadas válidas
  if (
    release?.is_active &&
    release.backpacks_pending > 0 &&
    release.valid_plays_remaining > 0 &&
    stock?.backpacks_remaining > 0
  ) {
    const remaining = release.valid_plays_remaining
    const probability = 1 / remaining
    const hit = Math.random() < probability

    await supabase
      .from('release_window')
      .update({
        valid_plays_remaining: remaining - 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', release.id)

    if (hit || remaining === 1) {
      result = 'BACKPACK'

      await supabase
        .from('daily_stock')
        .update({ backpacks_remaining: stock.backpacks_remaining - 1 })
        .eq('id', stock.id)

      await supabase
        .from('release_window')
        .update({
          backpacks_pending: 0,
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', release.id)
    }
  }

  // 7) Si no mochila → agua / sigue
  if (result !== 'BACKPACK') {
    result = Math.random() < 0.8 ? 'WATER' : 'TRY_AGAIN'
  }

  // 8) Guardar resultado
  await supabase
    .from('plays')
    .update({ result })
    .eq('player_id', player.id)

  return NextResponse.json({ result })
}
