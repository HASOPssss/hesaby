import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cavzaxxfnxkzsmiratyk.supabase.co'
const supabaseKey = 'sb_publishable_B6YjF_uKcUdFmX8FgiyTbQ_jZIJf-0J'

export const supabase = createClient(supabaseUrl, supabaseKey)
