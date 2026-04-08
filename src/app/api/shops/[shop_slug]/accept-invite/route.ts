import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/shops/[shop_slug]/accept-invite?code=INVITE_CODE
 *
 * Validates the invite code for the given shop, sets an HttpOnly cookie,
 * then redirects to the clean shop URL. This is the handler for invite links
 * of the form /{shop_slug}?invite=CODE (the page redirects here).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shop_slug: string }> }
) {
  const { shop_slug } = await params
  const code = request.nextUrl.searchParams.get('code')
  const shopUrl = new URL(`/${shop_slug}`, request.url)

  if (!code) {
    return NextResponse.redirect(shopUrl)
  }

  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('id, invite_code, is_private')
    .eq('slug', shop_slug)
    .maybeSingle()

  if (!shop?.is_private || shop.invite_code !== code) {
    // Invalid code – redirect to shop anyway; the page will show the form
    return NextResponse.redirect(shopUrl)
  }

  const response = NextResponse.redirect(shopUrl)
  response.cookies.set(`shop_invite_${shop.id}`, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'lax',
  })

  return response
}
