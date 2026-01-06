import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!

type PrizeKey = 'BUFF' | 'LANYARD' | 'BACKPACK' | 'WATER' | 'TRY_AGAIN'

function pickWeighted(items: Array<{ prize_key: PrizeKey; weight: number }>): PrizeKey {
  const list = items.filter(i => Number(i.weight) > 0)
  const total = list.reduce((s, i) => s + Number(i.weight), 0)
  if (total <= 0) return 'TRY_AGAIN'
  let r = Math.random() * total
  for (const i of list) {
    r -= Number(i.weight)
    if (r <= 0) return i.prize_key
  }
  return list[list.length - 1].prize_key
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const codeRaw = String(body?.code ?? '').trim()

    if (!/^\d{1,4}$/.test(codeRaw)) {
      return NextResponse.json({ ok: false, error: 'Código inválido.' }, { status: 400 })
    }

    const code = codeRaw.padStart(4, '0')

    // 1) Buscar registro y estado used
    const { data: reg, error: regErr } = await supabaseAdmin
      .from('registrations')
      .select('id, used')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('game_type', 'tombola')
      .eq('code', code)
      .maybeSingle()

    if (regErr) throw regErr
    if (!reg) return NextResponse.json({ ok: false, error: 'Código no encontrado.' }, { status: 404 })
    if (reg.used) return NextResponse.json({ ok: false, error: 'Este código ya fue usado.' }, { status: 409 })

    // 2) Leer ventana mochila
    const { data: release, error: relErr } = await supabaseAdmin
      .from('release_window')
      .select('is_enabled, remaining_spins')
      .eq('campaign_id', CAMPAIGN_ID)
      .maybeSingle()

    if (relErr) throw relErr

    // 3) Leer prize_weights (tombola)
    const { data: weights, error: wErr } = await supabaseAdmin
      .from('prize_weights')
      .select('prize_key, weight')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('game_type', 'tombola')

    if (wErr) throw wErr

    const allowed: PrizeKey[] = ['BUFF', 'LANYARD', 'BACKPACK', 'WATER', 'TRY_AGAIN']

    let normalized = (weights ?? [])
      .map((r: any) => ({
        prize_key: String(r.prize_key).toUpperCase() as PrizeKey,
        weight: Number(r.weight ?? 0),
      }))
      .filter(r => allowed.includes(r.prize_key))

    // fallback si la tabla está vacía
    if (!normalized.length) {
      normalized = [
        { prize_key: 'WATER', weight: 60 },
        { prize_key: 'LANYARD', weight: 20 },
        { prize_key: 'BUFF', weight: 10 },
        { prize_key: 'TRY_AGAIN', weight: 10 },
        { prize_key: 'BACKPACK', weight: 0 },
      ]
    }

    // 4) Determinar premio (regla ventana mochila)
    let prize: PrizeKey = 'TRY_AGAIN'
    const windowEnabled = Boolean(release?.is_enabled)
    const remaining = Number(release?.remaining_spins ?? 0)

    if (!windowEnabled) {
      const noBackpack = normalized.filter(n => n.prize_key !== 'BACKPACK')
      prize = pickWeighted(noBackpack.length ? noBackpack : [{ prize_key: 'TRY_AGAIN', weight: 1 }])
    } else {
      if (remaining <= 1) {
        prize = 'BACKPACK'
        await supabaseAdmin
          .from('release_window')
          .update({ is_enabled: false, remaining_spins: 0, updated_at: new Date().toISOString() })
          .eq('campaign_id', CAMPAIGN_ID)
      } else {
        await supabaseAdmin
          .from('release_window')
          .update({ remaining_spins: remaining - 1, updated_at: new Date().toISOString() })
          .eq('campaign_id', CAMPAIGN_ID)

        const noBackpack = normalized.filter(n => n.prize_key !== 'BACKPACK')
        prize = pickWeighted(noBackpack.length ? noBackpack : [{ prize_key: 'TRY_AGAIN', weight: 1 }])
      }
    }

    // 5) Marcar código como usado (anti doble canje)
    const { data: usedRow, error: useErr } = await supabaseAdmin
      .from('registrations')
      .update({
        used: true,
        used_at: new Date().toISOString(),
      })
      .eq('id', reg.id)
      .eq('used', false)
      .select('id')
      .maybeSingle()

    if (useErr) throw useErr
    if (!usedRow) {
      return NextResponse.json({ ok: false, error: 'Este código ya fue usado.' }, { status: 409 })
    }

    // 6) Guardar jugada en plays (bitácora del premio)
    const { error: playInsErr } = await supabaseAdmin.from('plays').insert({
      campaign_id: CAMPAIGN_ID,
      game_type: 'tombola',
      registration_id: reg.id,
      prize_key: prize,
    })

    // Si existe por doble click / carrera, ignoramos el duplicate
    if (playInsErr && playInsErr.code !== '23505') {
      throw playInsErr
    }

    return NextResponse.json({ ok: true, prize_key: prize })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error inesperado' }, { status: 500 })
  }
}
