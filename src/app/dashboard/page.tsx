import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Shop } from '@/types/database'
import InviteLinkButton from './invite-link-button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: shops } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-8">Tableau de bord</h1>

      <section>
        <h2 className="text-xl font-semibold mb-4">Mes boutiques</h2>

        {!shops?.length ? (
          <p className="text-muted-foreground">Vous n&apos;avez pas encore de boutique.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{shop.name}</CardTitle>
            <CardDescription className="mt-1 text-xs">
              /{shop.slug}
            </CardDescription>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            {shop.is_private ? (
              <Badge variant="secondary">Privée</Badge>
            ) : (
              <Badge variant="outline">Publique</Badge>
            )}
            {shop.stripe_charges_enabled ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                Paiements actifs
              </Badge>
            ) : null}
          </div>
        </div>
        {shop.description && (
          <CardDescription className="line-clamp-2 mt-2">
            {shop.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <a
          href={`/${shop.slug}`}
          className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
        >
          Voir la boutique
        </a>
        {shop.is_private && shop.invite_code && (
          <InviteLinkButton slug={shop.slug} inviteCode={shop.invite_code} />
        )}
      </CardContent>
    </Card>
  )
}
