import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { shop_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { shop_id } = body
  if (!shop_id) {
    return NextResponse.json({ error: 'shop_id is required' }, { status: 400 })
  }

  // Verify the authenticated user owns this shop
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id, owner_id, stripe_connect_id')
    .eq('id', shop_id)
    .eq('owner_id', user.id)
    .single()

  if (shopError || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }

  // Reuse existing account or create a new Express account
  let accountId = shop.stripe_connect_id

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      metadata: { shop_id },
    })
    accountId = account.id

    // Persist the account ID immediately (before onboarding completes)
    const { error: updateError } = await supabase
      .from('shops')
      .update({ stripe_connect_id: accountId })
      .eq('id', shop_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save Stripe account' }, { status: 500 })
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: `${appUrl}/api/stripe/connect/return`,
    refresh_url: `${appUrl}/api/stripe/connect?shop_id=${shop_id}`,
  })

  return NextResponse.json({ url: accountLink.url })
}
