import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const ADMIN_PIN = process.env.ADMIN_PIN || ''
const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!

function chileTodayISODate() {
  // Chile (America/Santiago) — evitamos dependencias, hacemos “fecha local” con Intl
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}` // YYYY-MM-DD
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { pin } = body as { pin: string }

    if (!ADMIN_PIN || pin !== ADMIN_PIN) {
      return NextResponse.json({ error: 'PIN inválido' }, { status: 401 })
    }

    // 1) Estado release_window (si no existe, lo devolvemos como null)
    const { data: releaseRow, error: releaseError } = await supabase
      .from('release_window')
      .select('*')
      .eq('campaign_id', CAMPAIGN_ID)
      .maybeSingle()

    if (releaseError) {
      return NextResponse.json({ error: releaseError.message }, { status: 500 })
    }

    // 2) Conteos del día (BACKPACK/WATER/TRY_AGAIN)
    const today = chileTodayISODate() // YYYY-MM-DD (Chile)
    const from = `${today}T00:00:00`
    const to = `${today}T23:59:59.999`

    const { data: plays, error: playsError } = await supabase
      .from('plays')
      .select('result, game_type, created_at')
      .eq('campaign_id', CAMPAIGN_ID)
      .gte('created_at', from)
      .lte('created_at', to)

    if (playsError) {
      // Si tu tabla no se llama "plays", aquí saldrá error.
      return NextResponse.json({
        error: `No pude leer tabla "plays". Si tu tabla se llama distinto, dime el nombre exacto. Detalle: ${playsError.message}`
      }, { status: 500 })
    }

    const counts = {
      BACKPACK: 0,
      WATER: 0,
      TRY_AGAIN: 0,
      TOTAL: plays?.length ?? 0,
      WHEEL: 0,
      SLOTS: 0,
    }

    for (const p of plays ?? []) {
      if (p.result === 'BACKPACK') counts.BACKPACK++
      else if (p.result === 'WATER') counts.WATER++
      else if (p.result === 'TRY_AGAIN') counts.TRY_AGAIN++

      if (p.game_type === 'wheel') counts.WHEEL++
      if (p.game_type === 'slots') counts.SLOTS++
    }

    return NextResponse.json({
      ok: true,
      release: releaseRow ?? null,
      counts,
      todayChile: today,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 })
  }
}
