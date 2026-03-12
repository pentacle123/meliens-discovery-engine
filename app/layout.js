import './globals.css'

export const metadata = {
  title: 'MELIENS DISCOVERY ENGINE',
  description: 'Algorithm Performance Platform for Discovery Commerce — Pentacle × AI',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
