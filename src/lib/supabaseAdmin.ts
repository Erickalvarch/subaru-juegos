import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL')
if (!serviceRole) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')

export const supabaseAdmin = createClient(url, serviceRole, {
  auth: { persistSession: false },
})
