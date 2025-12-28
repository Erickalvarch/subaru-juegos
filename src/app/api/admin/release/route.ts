import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const ADMIN_PIN = process.env.ADMIN_PIN || ''
const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { pin, enable, remainingSpins } = body as {
      pin: string
      enable: boolean
      remainingSpins?: number
    }

    if (!ADMIN_PIN || pin !== ADMIN_PIN) {
      return NextResponse.json({ error: 'PIN inválido' }, { status: 401 })
    }

    const updates: any = {
      is_enabled: !!enable,
      updated_at: new Date().toISOString(),
    }

    if (typeof remainingSpins === 'number') {
      updates.remaining_spins = Math.max(0, Math.floor(remainingSpins))
    }

    const { error } = await supabase
      .from('release_window')
      .upsert(
        {
          campaign_id: CAMPAIGN_ID,
          ...updates,
        },
        { onConflict: 'campaign_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 })
  }
}
