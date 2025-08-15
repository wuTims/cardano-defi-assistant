'use client';

import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { SupabaseProvider } from '@/context/SupabaseProvider'
import { QueryProvider } from '@/providers/query-provider'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <SupabaseProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </SupabaseProvider>
        </AuthProvider>
      </body>
    </html>
  )
}