import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!
const ADMIN_PIN = process.env.ADMIN_PIN!

type GameType = 'wheel' | 'tombola'

// premios posibles (global)
const PRIZES = ['BACKPACK', 'WATER', 'LANYARD', 'BUFF', 'BLANKET', 'TRY_AGAIN'] as const
type PrizeKey = (typeof PRIZES)[number]

function getChileYMD(d = new Date()) {
  // YYYY-MM-DD en Chile
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)

  const map: any = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value
  return `${map.year}-${map.month}-${map.day}`
}

function getOffsetMinutes(timeZone: string, date: Date) {
  // Node moderno soporta "shortOffset" -> "GMT-3", "GMT-4", etc.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(date)

  const tz = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+0'
  // tz ejemplo: "GMT-3"
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  const hh = parseInt(m[2], 10)
  const mm = m[3] ? parseInt(m[3], 10) : 0
  return sign * (hh * 60 + mm)
}

function getChileDayRangeUTC(now = new Date()) {
  const tz = 'America/Santiago'
  const ymd = getChileYMD(now)

  // creamos "medianoche Chile" con el offset real de ese momento (maneja DST)
  const startChileGuess = new Date(`${ymd}T00:00:00Z`)
  const offStart = getOffsetMinutes(tz, startChileGuess)
  const startUTC = new Date(Date.parse(`${ymd}T00:00:00Z`) - offStart * 60_000)

  // fin = mañana 00:00 Chile (con su offset)
  const endDate = new Date(startUTC.getTime() + 24 * 60 * 60_000)
  const ymdEnd = getChileYMD(endDate)
  const endChileGuess = new Date(`${ymdEnd}T00:00:00Z`)
  const offEnd = getOffsetMinutes(tz, endChileGuess)
  const endUTC = new Date(Date.parse(`${ymdEnd}T00:00:00Z`) - offEnd * 60_000)

  // para mostrar en panel tipo "05-01-2026"
  const todayChile = new Intl.DateTimeFormat('es-CL', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now)

  return { startUTC, endUTC, todayChile }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const pin = String(body?.pin ?? '').trim()

    if (!ADMIN_PIN || pin !== String(ADMIN_PIN).trim()) {
      return NextResponse.json({ error: 'PIN inválido' }, { status: 401 })
    }
    if (!CAMPAIGN_ID) {
      return NextResponse.json({ error: 'Falta NEXT_PUBLIC_CAMPAIGN_ID' }, { status: 500 })
    }

    const { startUTC, endUTC, todayChile } = getChileDayRangeUTC(new Date())

    // release window
    const { data: release, error: relErr } = await supabaseAdmin
      .from('release_window')
      .select('*')
      .eq('campaign_id', CAMPAIGN_ID)
      .maybeSingle()

    if (relErr) throw relErr

    // plays de hoy (Chile)
    const { data: plays, error: playsErr } = await supabaseAdmin
      .from('plays')
      .select('id, game_type, prize_key, created_at')
      .eq('campaign_id', CAMPAIGN_ID)
      .gte('created_at', startUTC.toISOString())
      .lt('created_at', endUTC.toISOString())

    if (playsErr) throw playsErr

    // counts
    const counts: Record<string, number> = {
      TOTAL: 0,
      WHEEL: 0,
      SLOTS: 0, // OJO: SLOTS = tombola, para no romper tu UI
    }

    for (const p of PRIZES) counts[p] = 0
    for (const p of PRIZES) {
      counts[`WHEEL_${p}`] = 0
      counts[`SLOTS_${p}`] = 0
    }

    for (const row of plays ?? []) {
      counts.TOTAL++

      const gt = String(row.game_type ?? '') as GameType
      const isWheel = gt === 'wheel'
      const isTombola = gt === 'tombola'

      if (isWheel) counts.WHEEL++
      if (isTombola) counts.SLOTS++

      const pk = String(row.prize_key ?? '').toUpperCase() as PrizeKey
      if (PRIZES.includes(pk)) {
        counts[pk]++
        if (isWheel) counts[`WHEEL_${pk}`]++
        if (isTombola) counts[`SLOTS_${pk}`]++
      }
    }

    return NextResponse.json({
      ok: true,
      todayChile,
      release: release ?? null,
      counts,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 })
  }
}
