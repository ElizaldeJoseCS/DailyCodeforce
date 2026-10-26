import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import ReportButton from "@/components/ReportButton";
import LiveCount from "@/components/LiveCount";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} – Daily Codeforces Practice Problems with Editorials`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "codeforces practice",
    "codeforces problems",
    "codeforces editorial",
    "competitive programming practice",
    "daily coding problems",
    "C++ solutions",
  ],
  // No canonical/og:url here — child pages inherit layout metadata, and a
  // root-level canonical would mark every page a duplicate of the homepage.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} – Daily Codeforces Practice`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} – Daily Codeforces Practice`,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="xp-shell">
            <Navbar />
            <main>{children}</main>
          </div>
          <LiveCount />
          <ReportButton />
        </Providers>
      </body>
    </html>
  );
}
