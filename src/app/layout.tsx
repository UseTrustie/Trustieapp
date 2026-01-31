import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trust Check - Verify AI Claims Against Real Sources',
  description: 'Fact-check AI answers against real sources. Not AI opinion - actual links you can verify yourself.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 min-h-screen">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
