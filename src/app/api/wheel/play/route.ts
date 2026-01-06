import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!

type PrizeKey = 'BUFF' | 'BLANKET' | 'LANYARD' | 'TRY_AGAIN'

function pickWeighted(items: Array<{ prize_key: PrizeKey; weight: number }>): PrizeKey {
  const list = items.filter(i => (i.weight ?? 0) > 0)
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

    const name = String(body?.name ?? '').trim()
    const rut = String(body?.rut ?? '').trim()
    const phone = String(body?.phone ?? '').trim()
    const email = String(body?.email ?? '').toLowerCase().trim()
    const comuna = String(body?.comuna ?? '').trim()
    const modelPreference = String(body?.modelPreference ?? '').trim()

    if (!CAMPAIGN_ID) {
      return NextResponse.json({ ok: false, error: 'Falta NEXT_PUBLIC_CAMPAIGN_ID' }, { status: 500 })
    }

    // Validación mínima (móvil)
    if (!name || !email || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Nombre y email válidos son requeridos' }, { status: 400 })
    }

    // 1) Buscar o crear registration (1 por email para wheel)
    const { data: existingReg, error: regFindErr } = await supabaseAdmin
      .from('registrations')
      .select('id')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('game_type', 'wheel')
      .eq('email', email)
      .maybeSingle()

    if (regFindErr) throw regFindErr

    let registrationId = existingReg?.id as string | undefined

    if (!registrationId) {
      const { data: createdReg, error: regInsErr } = await supabaseAdmin
        .from('registrations')
        .insert({
          campaign_id: CAMPAIGN_ID,
          game_type: 'wheel',
          name,
          rut,
          phone,
          email,
          comuna,
          model_preference: modelPreference,
        })
        .select('id')
        .single()

      if (regInsErr) throw regInsErr
      registrationId = createdReg.id
    }

    // 2) Ver si ya jugó (por registration_id)
    const { data: existingPlay, error: playFindErr } = await supabaseAdmin
      .from('plays')
      .select('id')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('game_type', 'wheel')
      .eq('registration_id', registrationId)
      .maybeSingle()

    if (playFindErr) throw playFindErr

    if (existingPlay) {
      return NextResponse.json(
        { ok: false, reason: 'ALREADY_PLAYED', message: 'Ya participaste en la ruleta.' },
        { status: 200 }
      )
    }

    // 3) Obtener pesos desde prize_weights
    const { data: weights, error: wErr } = await supabaseAdmin
      .from('prize_weights')
      .select('prize_key, weight')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('game_type', 'wheel')

    if (wErr) throw wErr

    const allowed: PrizeKey[] = ['BUFF', 'BLANKET', 'LANYARD', 'TRY_AGAIN']

    const normalized = (weights || [])
      .map((r: any) => ({ prize_key: r.prize_key as PrizeKey, weight: Number(r.weight || 0) }))
      .filter((r) => allowed.includes(r.prize_key))

    const prize = pickWeighted(normalized.length ? normalized : [{ prize_key: 'TRY_AGAIN', weight: 1 }])

    // 4) Insertar play (SIN email, usando registration_id)
    const { error: playInsErr } = await supabaseAdmin.from('plays').insert({
      campaign_id: CAMPAIGN_ID,
      game_type: 'wheel',
      registration_id: registrationId,
      prize_key: prize,
    })

    if (playInsErr) throw playInsErr

    return NextResponse.json({ ok: true, prize_key: prize })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Error' }, { status: 500 })
  }
}
