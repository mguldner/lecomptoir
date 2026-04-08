import { NextResponse } from 'next/server'

// Stripe redirects vendors here after completing (or dismissing) Express onboarding.
// The webhook `account.updated` is the source of truth for DB updates.
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  return NextResponse.redirect(`${appUrl}/dashboard?stripe=connected`)
}
