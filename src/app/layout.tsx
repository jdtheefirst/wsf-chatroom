// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";
import { Providers } from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// App configuration
const APP_NAME = "WSF Chatrooms";
const APP_DESCRIPTION =
  "World Samma Federation Chatrooms - Connect with martial arts enthusiasts worldwide";
const APP_URL = "https://chat.worldsamma.org";
const APP_THEME_COLOR = "#dc2626"; // WSF brand red
const APP_KEYWORDS = [
  "Wing Chun",
  "Samma",
  "Martial Arts",
  "WSF",
  "Chat",
  "Community",
  "Kung Fu",
  "Fighting",
  "Sports",
  "Discussion",
];

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: "World Sanshou Federation" }],
  generator: "Next.js",
  keywords: APP_KEYWORDS,
  creator: "World Sanshou Federation",
  publisher: "World Sanshou Federation",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
    images: [
      {
        url: "/og-image.jpg", // You'll need to create this
        width: 1200,
        height: 630,
        alt: "WSF Chatrooms - Connect with martial arts enthusiasts worldwide",
      },
    ],
  },

  // Twitter
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/og-image.jpg"],
    creator: "@WorldSamma",
    site: "@WorldSamma",
  },

  // Icons
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: APP_THEME_COLOR,
      },
    ],
  },

  // App Links
  appLinks: {
    web: {
      url: APP_URL,
      should_fallback: true,
    },
  },

  // Additional metadata
  category: "sports",
  classification: "Martial Arts Community",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Basic favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />

        {/* Modern browsers */}
        <link
          rel="icon"
          href="/favicon-32x32.png"
          type="image/png"
          sizes="32x32"
        />
        <link
          rel="icon"
          href="/favicon-16x16.png"
          type="image/png"
          sizes="16x16"
        />

        {/* Apple Touch Icon */}
        <link
          rel="apple-touch-icon"
          href="/apple-touch-icon.png"
          type="image/png"
          sizes="180x180"
        />

        {/* Progressive Web App Manifest */}
        <link
          rel="manifest"
          href="/site.webmanifest"
          crossOrigin="use-credentials"
        />

        {/* Preconnect to important domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://supabase.co" />

        {/* Canonical URL */}
        <link rel="canonical" href={APP_URL} />

        {/* Apple Smart App Banner */}
        {/* <meta name="apple-itunes-app" content="app-id=your-app-id" /> */}

        {/* Structured Data - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "World Samma Federation",
              url: "https://www.worldsamma.org",
              logo: "https://www.worldsamma.org/android-chrome-192x192.png",
              sameAs: [
                "https://twitter.com/WorldSamma",
                "https://facebook.com/WorldSamma",
                "https://instagram.com/worldsamma",
                "https://youtube.com/@WorldSamma",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                email: "support@worldsamma.org",
                contactType: "customer service",
              },
            }),
          }}
        />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          "overscroll-none", // Prevent pull-to-refresh on mobile
          geistSans.variable,
          geistMono.variable
        )}
        suppressHydrationWarning
      >
        <Providers>
          {/* Global loading indicator for page transitions */}
          <div
            id="global-loader"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-300 opacity-0 pointer-events-none"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-sm text-muted-foreground">
                Loading WSF Chatrooms...
              </p>
            </div>
          </div>

          {children}
        </Providers>
      </body>
    </html>
  );
}
