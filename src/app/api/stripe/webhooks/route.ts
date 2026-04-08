import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import type { Database } from '@/types/database'
import type Stripe from 'stripe'

// Prevent Next.js from caching or buffering this route
export const dynamic = 'force-dynamic'

// Service-role client: bypasses RLS since webhooks run without a user session
function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account

    if (account.charges_enabled) {
      const supabase = createServiceClient()
      const { error } = await supabase
        .from('shops')
        .update({ stripe_charges_enabled: true })
        .eq('stripe_connect_id', account.id)

      if (error) {
        console.error('[stripe/webhooks] Failed to update stripe_charges_enabled:', error)
        return new Response('Database update failed', { status: 500 })
      }
    }
  }

  return new Response('ok', { status: 200 })
}
