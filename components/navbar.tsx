'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ThemeToggle } from './theme-toggle';
import { cn } from '@/lib/utils';
import { BarChart3, Briefcase, Bot, TrendingUp, Wallet, LogIn, LogOut, User } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/agents/recommendations', label: 'Recommendations', icon: TrendingUp },
  { href: '/virtual-portfolio', label: 'Virtual Portfolio', icon: Wallet },
];

/**
 * Top navigation bar with futuristic neon styling
 */
export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/60 backdrop-blur-xl">
      {/* Top accent line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <span className="font-display font-bold text-sm text-primary neon-text">M</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-display font-bold text-sm tracking-wider text-primary neon-text">CRYPTO</span>
              <span className="font-display font-bold text-sm tracking-wider text-foreground">MAESTRO</span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-sans">{label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
            <span className="font-mono text-[10px] uppercase tracking-wider">Live</span>
          </div>

          {/* Auth */}
          {status === 'authenticated' && session?.user ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <User className="h-3.5 w-3.5" />
                {session.user.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : status === 'unauthenticated' ? (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          ) : null}

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
