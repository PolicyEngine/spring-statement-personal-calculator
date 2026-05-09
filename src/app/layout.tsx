import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

const TITLE = 'Spring Statement 2026 personal calculator | PolicyEngine';
const DESCRIPTION =
  "See how the Spring Statement 2026 policy changes affect your household's taxes and benefits. Free, open-source calculator powered by PolicyEngine.";
const CANONICAL = 'https://policyengine.org/uk/spring-statement';
const OG_IMAGE = 'https://policyengine.org/assets/logos/policyengine/teal.png';
const GA_MEASUREMENT_ID = 'G-2YHG89FY0N';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website',
    title: 'Spring Statement 2026 personal calculator',
    description:
      "See how the Spring Statement 2026 policy changes affect your household's taxes and benefits.",
    url: CANONICAL,
    siteName: 'PolicyEngine',
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ThePolicyEngine',
    title: 'Spring Statement 2026 personal calculator',
    description:
      "See how the Spring Statement 2026 policy changes affect your household's taxes and benefits.",
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
