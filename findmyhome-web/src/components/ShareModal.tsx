'use client'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import QRCode from 'react-qr-code'
import { Copy, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  propertyId: string
  title: string
  open: boolean
  onClose: () => void
}

export function ShareModal({ propertyId, title, open, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://findmyhomeuganda.com'
  const url = `${origin}/properties/${propertyId}`

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Check out this property on FindMyHome:\n${title}\n${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-medium text-ink text-lg">Share Listing</Dialog.Title>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-sand flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-stone" />
            </button>
          </div>

          <p className="text-xs text-stone mb-5 truncate">{title}</p>

          {/* QR Code */}
          <div className="flex justify-center mb-5 p-4 bg-sand rounded-xl">
            <QRCode value={url} size={180} />
          </div>

          {/* Copyable link */}
          <div className="flex items-center gap-2 bg-cream border border-sand rounded-xl px-3 py-2.5 mb-3">
            <span className="flex-1 text-xs text-stone truncate">{url}</span>
            <button onClick={copy} className="flex-shrink-0 w-7 h-7 rounded-lg bg-ink text-white flex items-center justify-center transition-colors hover:bg-stone">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* WhatsApp share */}
          <button
            onClick={shareWhatsApp}
            className="w-full py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
          >
            Share on WhatsApp
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
