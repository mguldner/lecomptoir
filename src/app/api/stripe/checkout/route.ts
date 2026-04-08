import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

interface LineItem {
  price_data?: {
    currency: string
    unit_amount: number
    product_data: { name: string; images?: string[] }
  }
  price?: string
  quantity?: number
}

interface CheckoutBody {
  shop_id: string
  line_items: LineItem[]
  success_url?: string
  cancel_url?: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  let body: CheckoutBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { shop_id, line_items, success_url, cancel_url } = body

  if (!shop_id || !line_items?.length) {
    return NextResponse.json({ error: 'shop_id and line_items are required' }, { status: 400 })
  }

  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id, stripe_connect_id, stripe_charges_enabled')
    .eq('id', shop_id)
    .single()

  if (shopError || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }

  if (!shop.stripe_connect_id || !shop.stripe_charges_enabled) {
    return NextResponse.json(
      { error: 'This shop has not completed Stripe onboarding' },
      { status: 422 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const commissionRate = Number(process.env.STRIPE_COMMISSION_RATE ?? 0)

  // Compute total amount (in smallest currency unit) for the platform fee.
  // line_items use unit_amount (cents) × quantity.
  const totalCents = line_items.reduce((sum, item) => {
    const unitAmount = item.price_data?.unit_amount ?? 0
    const qty = item.quantity ?? 1
    return sum + unitAmount * qty
  }, 0)

  const applicationFeeAmount = Math.round(totalCents * commissionRate)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: line_items as any,
    mode: 'payment',
    payment_intent_data: {
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: shop.stripe_connect_id,
      },
    },
    success_url: success_url ?? `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancel_url ?? `${appUrl}/cancel`,
  })

  return NextResponse.json({ url: session.url })
}
