export const metadata = {
  title: "Aftertrack",
  description: "Tu diario musical. Reseñá álbumes, seguí amigos y descubrí música.",
  manifest: "/manifest.json",
  themeColor: "#7c6fff",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aftertrack",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  openGraph: {
    title: "Aftertrack",
    description: "Tu diario musical. Reseñá álbumes, seguí amigos y descubrí música.",
    type: "website",
    url: "https://aftertrack.app",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "Aftertrack",
    description: "Tu diario musical. Reseñá álbumes, seguí amigos y descubrí música.",
    images: ["/icons/icon-512.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json"/>
        <link rel="apple-touch-icon" href="/icons/icon-192.png"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <meta name="apple-mobile-web-app-title" content="Aftertrack"/>
        <meta name="mobile-web-app-capable" content="yes"/>
        <meta name="theme-color" content="#7c6fff"/>
        <meta name="msapplication-TileColor" content="#7c6fff"/>
        <meta name="msapplication-TileImage" content="/icons/icon-192.png"/>
      </head>
      <body>{children}</body>
    </html>
  );
}
