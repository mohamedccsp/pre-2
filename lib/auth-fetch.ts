/**
 * Fetch wrapper that redirects to /login on 401 responses.
 * Drop-in replacement for window.fetch() in Zustand stores.
 * @param input - URL or Request
 * @param init - Optional fetch options
 * @returns Response from the fetch call
 * @throws Error if the response is 401 (after redirect) or other non-ok status
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  return response;
}
