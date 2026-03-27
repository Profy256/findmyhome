import type { Metadata } from 'next'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { Providers } from '@/components/layout/Providers'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-cormorant',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
})

export const metadata: Metadata = {
  title: 'Find My Home — Uganda Real Estate',
  description: "Uganda's most trusted real estate marketplace. Verified sellers, genuine listings, zero scams.",
  keywords: 'property Uganda, houses for sale Kampala, land Uganda, apartments Kampala',
  openGraph: {
    title: 'Find My Home Uganda',
    description: 'Search verified properties across Uganda',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable}`}>
      <body className="font-body bg-paper text-ink antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { fontFamily: 'var(--font-jost)', fontSize: '14px' },
              success: { iconTheme: { primary: '#2d4a3e', secondary: '#fff' } },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
