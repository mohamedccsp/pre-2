import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/providers';
import { Navbar } from '@/components/navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'CryptoMAESTRO',
  description: 'Crypto research & trading platform with multi-agent architecture',
};

/**
 * Root layout — wraps all pages with session provider, theme provider, and navbar
 * @param children - Page content
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <Providers>
          <ThemeProvider>
            <Navbar />
            <main className="mx-auto max-w-7xl px-4 py-6 animate-fade-in">
              {children}
            </main>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
