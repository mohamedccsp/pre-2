import { withAuth } from 'next-auth/middleware';

/**
 * NextAuth middleware — redirects unauthenticated users to /login
 * for protected routes. Market data and the dashboard stay public.
 */
export default withAuth({
  pages: {
    signIn: '/login',
  },
});

/** Routes that require authentication */
export const config = {
  matcher: [
    '/portfolio/:path*',
    '/virtual-portfolio/:path*',
    '/agents/:path*',
  ],
};
