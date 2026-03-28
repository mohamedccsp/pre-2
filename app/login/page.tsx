'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/**
 * Login / Register page with legal disclaimer.
 * Toggles between sign-in and registration forms.
 */
export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Handle form submission for both login and registration
   * @param e - Form submit event
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        // Register first, then auto-login
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Registration failed');
          setLoading(false);
          return;
        }
      }

      // Sign in with NextAuth
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            <span className="text-primary">Crypto</span>MAESTRO
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRegister ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
          {isRegister && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Your name"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'}
              minLength={isRegister ? 8 : undefined}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-primary hover:underline font-medium"
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </p>
        </form>

        {/* Legal Disclaimer */}
        <div className="rounded-lg border border-border bg-card/50 p-4 text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground mb-2">IMPORTANT LEGAL NOTICE AND DISCLAIMER</p>
          <p>
            By creating an account or accessing CryptoMAESTRO (&quot;the Platform&quot;), you acknowledge and
            agree to the following terms:
          </p>
          <p className="mt-2">
            <strong>No Financial Advice.</strong> The Platform is provided solely for educational and
            informational purposes. Nothing contained herein constitutes, or shall be construed as,
            investment advice, financial advice, trading advice, or any recommendation to buy, sell,
            or hold any cryptocurrency or digital asset. All analyses, recommendations, and outputs
            generated by the Platform&apos;s automated agents are simulated and are not intended to
            serve as the basis for any real-world investment decision.
          </p>
          <p className="mt-2">
            <strong>Virtual Trading Only.</strong> All portfolio balances, trades, profits, and losses
            displayed on the Platform are entirely simulated using virtual funds. No real money, cryptocurrency,
            or digital assets are transacted, held, or managed by the Platform at any time.
          </p>
          <p className="mt-2">
            <strong>Assumption of Risk.</strong> Cryptocurrency markets are inherently volatile and
            speculative. Any decision to invest real funds in cryptocurrency or digital assets is made
            solely at your own risk and discretion. CryptoMAESTRO, its developers, operators, and
            affiliates shall bear no liability whatsoever for any financial loss, damage, or adverse
            consequence arising from any investment decision made by the user, whether or not such
            decision was informed by the Platform&apos;s simulated outputs.
          </p>
          <p className="mt-2">
            <strong>No Warranty.</strong> The Platform is provided &quot;as is&quot; and &quot;as
            available&quot; without warranty of any kind, express or implied, including but not
            limited to warranties of merchantability, fitness for a particular purpose, accuracy,
            or non-infringement. Market data is sourced from third-party providers and may be
            delayed, incomplete, or inaccurate.
          </p>
          <p className="mt-2">
            <strong>Limitation of Liability.</strong> In no event shall CryptoMAESTRO or its
            developers be liable for any direct, indirect, incidental, special, consequential,
            or punitive damages arising from your use of or inability to use the Platform.
          </p>
          <p className="mt-2 font-medium text-foreground">
            By proceeding, you confirm that you have read, understood, and agree to be bound by
            this disclaimer in its entirety.
          </p>
        </div>
      </div>
    </div>
  );
}
