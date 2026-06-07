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
          content="Explore Sri Lanka datasets on an interactive map, time controls, and comparative charts."
        />
        <meta property="og:title" content="Sri Lanka Data Visualizer" />
        <meta
          property="og:description"
          content="Interactive map and time-series explorer for Sri Lanka district and province datasets."
        />
        <link rel="icon" href="/favicon.ico" />
        <title>Sri Lanka Data Visualizer</title>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  )
}
