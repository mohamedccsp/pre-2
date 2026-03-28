import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * NextAuth configuration with CredentialsProvider + JWT strategy.
 * JWT avoids the need for a server-side sessions table — session data
 * lives entirely in an encrypted HttpOnly cookie.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      /**
       * Validate email + password against the users table
       * @param credentials - Email and password from the login form
       * @returns User object if valid, null otherwise
       */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const rows = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email.toLowerCase().trim()))
          .limit(1);

        if (rows.length === 0) return null;

        const user = rows[0];
        const passwordMatch = await compare(credentials.password, user.hashedPassword);

        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    /**
     * Attach user ID to the JWT token so it's available in the session
     * @param token - JWT token being created
     * @param user - User object from authorize (only present on sign-in)
     * @returns Token with userId attached
     */
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    /**
     * Expose userId in the client-side session object
     * @param session - Session object sent to the client
     * @param token - JWT token containing the userId
     * @returns Session with userId attached
     */
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
};
