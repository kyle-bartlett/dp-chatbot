import './globals.css'
import Providers from '@/components/Providers'

export const metadata = {
  title: 'Anker DP Assistant | Demand Planning Knowledge Hub',
  description: 'AI-powered assistant for Anker Demand Planning team - CPFR, forecasting, and supply chain knowledge at your fingertips.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
