import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rabt HQ — AI Business OS',
  description: 'Complete AI-powered business operating system for Rabt Naturals',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Outfit:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#151820',
              color: '#EEEAE3',
              border: '1px solid rgba(255,255,255,0.11)',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontFamily: 'Outfit, sans-serif',
            },
            success: { iconTheme: { primary: '#22C55E', secondary: '#151820' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#151820' } },
          }}
        />
      </body>
    </html>
  )
}
