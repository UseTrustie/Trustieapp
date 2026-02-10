import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trustie - Verify AI Claims with Real Sources',
  description: 'No more blind trusting AI. Verify AI claims against real sources in seconds. See what is true, false, or unconfirmed with links to proof.',
  keywords: 'AI fact checker, verify AI, ChatGPT fact check, AI hallucination, trust AI, fact verification',
  authors: [{ name: 'Trustie' }],
  openGraph: {
    title: 'Trustie - Verify AI Claims with Real Sources',
    description: 'No more blind trusting AI. Verify AI claims against real sources in seconds.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trustie - Verify AI Claims with Real Sources',
    description: 'No more blind trusting AI. Verify AI claims against real sources in seconds.',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
