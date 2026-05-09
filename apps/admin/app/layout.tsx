import type { Metadata } from "next";
import { Manrope, Work_Sans, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { NavigationWrapper } from "@/components/NavigationWrapper";
import { ThemeProvider } from "@/components/theme-provider";
import { PageWrapper } from "@/components/PageWrapper";
import { RealtimeBridge } from "@/components/realtime-bridge";
import { ToastHost } from "@/components/toast-host";
import { getAdminTokenForClient } from "@/lib/admin-token";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-headline",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "VouchrEx Admin",
  description: "Admin console for VouchrEx operations",
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const realtimeToken = await getAdminTokenForClient();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${workSans.variable} ${jetbrainsMono.variable}`}>
        <RealtimeBridge token={realtimeToken} />
        <ToastHost />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="min-h-screen">
            <Suspense fallback={null}>
              <NavigationWrapper />
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
