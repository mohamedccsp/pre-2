'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * Client-side session provider wrapper for NextAuth.
 * Must wrap all components that use useSession().
 * @param children - Child components
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
