import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://novel-tribe.com"),
  title: {
    default: "NovelTribe | Track Your Reading",
    template: "%s | NovelTribe",
  },
  description:
    "Track the books you read, discover your next favorite, and get personalized recommendations from NovelTribe.",
  keywords: [
    "book tracker",
    "reading tracker",
    "book recommendations",
    "reading list",
    "book discovery",
    "reading community",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://novel-tribe.com",
    siteName: "NovelTribe",
    title: "NovelTribe | Track Your Reading",
    description: "Track your reading and discover your next obsession.",
    images: [{ url: "/icon.png", width: 1254, height: 1254, alt: "NovelTribe" }],
  },
  twitter: {
    card: "summary",
    title: "NovelTribe | Track Your Reading",
    description: "Track your reading and discover your next obsession.",
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.png", sizes: "1254x1254", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "1254x1254", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#09090b] text-white">
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-213KRMC0KT"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-213KRMC0KT');
          `}
        </Script>
      </body>
    </html>
  );
}
