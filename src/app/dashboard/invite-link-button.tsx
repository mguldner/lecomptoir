'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy, Link } from 'lucide-react'

interface Props {
  slug: string
  inviteCode: string
}

export default function InviteLinkButton({ slug, inviteCode }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = `${window.location.origin}/${slug}?invite=${encodeURIComponent(inviteCode)}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-2 text-green-600" />
          Lien copié !
        </>
      ) : (
        <>
          <Link className="h-4 w-4 mr-2" />
          Générer un lien d&apos;invitation
        </>
      )}
    </Button>
  )
}
