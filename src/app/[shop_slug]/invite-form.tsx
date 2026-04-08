'use client'

import { useActionState } from 'react'
import { verifyInviteCode } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock } from 'lucide-react'

interface Props {
  slug: string
  shopName: string
}

export default function InviteForm({ slug, shopName }: Props) {
  const [state, action, pending] = useActionState(verifyInviteCode, { error: null })

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Boutique privée</CardTitle>
          <CardDescription>
            <strong>{shopName}</strong> est une boutique privée. Entrez votre
            code d&apos;invitation pour y accéder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-2">
              <Label htmlFor="invite_code">Code d&apos;invitation</Label>
              <Input
                id="invite_code"
                name="invite_code"
                placeholder="Entrez votre code"
                autoComplete="off"
                autoFocus
                required
              />
            </div>
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Vérification…' : 'Accéder à la boutique'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
