import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Source_Sans_3, Fraunces } from 'next/font/google'
import { THEME_SCRIPT } from '@/lib/theme'
import { PwaRegister } from '@/components/pwa/pwa-register'
import { OfflineBanner } from '@/components/pwa/offline-banner'
import './globals.css'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'UniMerch — Sorsogon State University',
  description:
    'UniMerch, the official campus marketplace of Sorsogon State University. Browse and buy campus goods; verify your identity to unlock restricted, role-based items.',
  applicationName: 'UniMerch',
  // The web app manifest comes from app/manifest.ts; these cover browser tabs and iOS home screens
  icons: {
    icon: [
      // Maroon cart on light browser themes, gold cart on dark ones
      { url: '/icons/favicon-light-32.png', sizes: '32x32', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/icons/favicon-dark-32.png', sizes: '32x32', type: 'image/png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
  },
  appleWebApp: {
    capable: true,
    title: 'UniMerch',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
}

// Light by default regardless of the device setting; dark mode is an in-app choice (lib/theme.ts)
export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#7a1f2b',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background ${sourceSans.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        {/* Keyboard / screen-reader users jump past the header and menus */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-100 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:outline-2 focus:outline-primary">
          Skip to content
        </a>
        <OfflineBanner />
        {children}
        <PwaRegister />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
