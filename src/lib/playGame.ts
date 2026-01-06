import { supabaseAdmin } from '@/lib/supabaseAdmin'

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

export async function playGame(params: { name: string; email: string; gameType: GameType }) {
  const { name, email, gameType } = params

  const cleanEmail = email.toLowerCase().trim()
  const cleanName = name.trim()

  if (!cleanEmail.includes('@')) return { ok: false, error: 'Email inválido' }
  if (!cleanName) return { ok: false, error: 'Nombre requerido' }

  // 1) Validar campaña
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('campaign')
    .select('*')
    .eq('id', CAMPAIGN_ID)
    .single()

  if (campErr) return { ok: false, error: campErr.message }
  if (!campaign || !campaign.is_active) return { ok: false, error: 'Campaña no activa' }

  // 2) Player único por campaña
  const { data: existingPlayer, error: plySelErr } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('email', cleanEmail)
    .maybeSingle()

  if (plySelErr) return { ok: false, error: plySelErr.message }

  if (!existingPlayer) {
    const { error: insErr } = await supabaseAdmin.from('players').insert({
      campaign_id: CAMPAIGN_ID,
      name: cleanName,
      email: cleanEmail,
    })

    if (insErr && insErr.code !== '23505') {
      return { ok: false, error: insErr.message }
    }
  }

  // 3) Pesos
  const { data: weights, error: wErr } = await supabaseAdmin
    .from('prize_weights')
    .select('prize_key, weight')
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('game_type', gameType)

  if (wErr) return { ok: false, error: wErr.message }

  const allowed: PrizeKey[] =
    gameType === 'wheel'
      ? ['BACKPACK', 'WATER', 'LANYARD', 'BLANKET', 'TRY_AGAIN']
      : ['BACKPACK', 'WATER', 'LANYARD', 'TRY_AGAIN']

  const normalized = (weights || [])
    .map(w => ({ prize_key: w.prize_key as PrizeKey, weight: Number(w.weight || 0) }))
    .filter(w => allowed.includes(w.prize_key))

  const result = pickWeighted(normalized.length ? normalized : [{ prize_key: 'TRY_AGAIN', weight: 1 }])

  // 4) Guardar jugada
  const { error: playErr } = await supabaseAdmin.from('plays').insert({
    campaign_id: CAMPAIGN_ID,
    email: cleanEmail,
    name: cleanName,
    game_type: gameType,
    result,
  })

  if (playErr?.code === '23505') {
    return {
      ok: false,
      reason: 'ALREADY_PLAYED',
      message: 'Ya participaste en esta campaña. ¡Gracias por jugar!',
    }
  }

  if (playErr) return { ok: false, error: playErr.message }

  return { ok: true, result }
}
