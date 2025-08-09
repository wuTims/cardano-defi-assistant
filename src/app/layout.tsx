import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { SupabaseProvider } from '@/context/SupabaseProvider'
import { WalletProvider } from '@/context/WalletProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Wallet Sync Service',
  description: 'Cardano wallet synchronization and portfolio tracking',
}

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
            <WalletProvider>
              {children}
            </WalletProvider>
          </SupabaseProvider>
        </AuthProvider>
      </body>
    </html>
  )
}