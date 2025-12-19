import './globals.css'
import Providers from '@/components/Providers'

export const metadata = {
  title: 'Anker Charging Knowledge Hub | Team Assistant',
  description: 'AI-powered assistant for Anker Charging teams — CPFR, forecasting, PSI, SOPs, training, and operational knowledge.',
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
