'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface State {
  error: string | null
}

export async function verifyInviteCode(
  _prevState: State,
  formData: FormData
): Promise<State> {
  const slug = formData.get('slug') as string
  const code = formData.get('invite_code') as string

  if (!slug || !code) {
    return { error: 'Données manquantes.' }
  }

  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('id, invite_code, is_private')
    .eq('slug', slug)
    .maybeSingle()

  if (!shop?.is_private || shop.invite_code !== code) {
    return { error: 'Code d\'invitation invalide.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(`shop_invite_${shop.id}`, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'lax',
  })

  redirect(`/${slug}`)
}
