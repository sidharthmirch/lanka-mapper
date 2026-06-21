import './globals.css'
import localFont from 'next/font/local'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-sans',
  display: 'swap',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-mono',
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta
          name="description"
          content="A data terminal over Sri Lanka's open datasets: choropleth map, year playback, comparative time series, and a searchable catalog from LDFLK and Lanka Data Search."
        />
        <meta name="theme-color" content="#0f1311" />
        <meta property="og:title" content="Sri Lanka Open Data Terminal" />
        <meta
          property="og:description"
          content="Interactive map, year playback, and time-series explorer across Sri Lanka district, province, and national datasets."
        />
        <link rel="icon" href="/favicon.ico" />
        <title>Sri Lanka Open Data Terminal</title>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  )
}
