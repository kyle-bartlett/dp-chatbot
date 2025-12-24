import './globals.css'
import Providers from '@/components/Providers'
import { Space_Grotesk } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata = {
  title: 'Anker N.A. Offline Planning Assistant',
  description: 'AI-powered assistant for Anker North America planning teams - CPFR, forecasting, supply chain, and training knowledge at your fingertips.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.className} antialiased app-shell`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
