import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database, Product } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import InviteForm from './invite-form'

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ shop_slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { shop_slug } = await params
  const query = await searchParams
  const invite = typeof query.invite === 'string' ? query.invite : undefined

  // Redirect invite links to the route handler that sets the cookie
  if (invite) {
    redirect(`/api/shops/${shop_slug}/accept-invite?code=${encodeURIComponent(invite)}`)
  }

  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, slug, description, is_private, invite_code, owner_id, address')
    .eq('slug', shop_slug)
    .maybeSingle()

  if (!shop) notFound()

  if (shop.is_private) {
    const cookieStore = await cookies()
    const savedCode = cookieStore.get(`shop_invite_${shop.id}`)?.value ?? null

    const { data: accessible } = await supabase.rpc('is_shop_accessible', {
      p_shop_id: shop.id,
      p_provided_invite: savedCode,
    })

    if (!accessible) {
      return <InviteForm slug={shop_slug} shopName={shop.name} />
    }
  }

  // Fetch products. For private shops with invite-code access, use the admin
  // client to bypass RLS (access was already verified above server-side).
  let products: Product[] = []

  if (shop.is_private) {
    const admin = createSupabaseAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await admin
      .from('products')
      .select('*')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
    products = data ?? []
  } else {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
    products = data ?? []
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{shop.name}</h1>
          {shop.is_private && <Badge variant="secondary">Boutique privée</Badge>}
        </div>
        {shop.description && (
          <p className="text-muted-foreground mt-1">{shop.description}</p>
        )}
        {shop.address && (
          <p className="text-sm text-muted-foreground mt-2">{shop.address}</p>
        )}
      </header>

      {products.length === 0 ? (
        <p className="text-muted-foreground">Aucun produit disponible pour le moment.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  )
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="overflow-hidden flex flex-col">
      {product.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-48 object-cover"
        />
      )}
      <CardHeader className="flex-1">
        <CardTitle className="text-lg">{product.name}</CardTitle>
        {product.description && (
          <CardDescription className="line-clamp-2">{product.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-xl font-semibold">
            {Number(product.price).toFixed(2)} €
          </span>
          {product.stock > 0 ? (
            <Badge variant="outline">{product.stock} en stock</Badge>
          ) : (
            <Badge variant="destructive">Épuisé</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
