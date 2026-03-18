import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { PageWrapper } from "@/components/PageWrapper";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "CouponBazaar Admin",
  description: "Admin console for CouponBazaar operations",
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={geist.variable}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="min-h-screen">
            <Suspense fallback={null}>
              <Navigation />
            </Suspense>
            <Suspense fallback={<main>{children}</main>}>
              <PageWrapper>{children}</PageWrapper>
            </Suspense>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
