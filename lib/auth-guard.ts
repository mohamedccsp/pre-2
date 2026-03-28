import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

/**
 * Extract the authenticated user ID from the session.
 * Returns null if not authenticated — callers should return 401.
 * @returns userId string or null
 */
export async function getAuthUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

/**
 * Standard 401 response for unauthenticated requests
 * @returns NextResponse with 401 status
 */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
