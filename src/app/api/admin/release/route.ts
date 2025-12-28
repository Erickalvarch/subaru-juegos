import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID!
const ADMIN_PIN = process.env.ADMIN_PIN!

export async function POST(req: Request) {
  const { pin } = await req.json()

  if (pin !== ADMIN_PIN) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }

  await supabase
    .from('release_window')
    .update({
      is_active: true,
      valid_plays_remaining: 10,
      backpacks_pending: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('campaign_id', CAMPAIGN_ID)

  return NextResponse.json({ ok: true })
}
EOF
