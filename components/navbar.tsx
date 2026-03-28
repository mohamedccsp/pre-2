'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { cn } from '@/lib/utils';
import { BarChart3, Briefcase, Bot, TrendingUp, Wallet } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/agents/recommendations', label: 'Recommendations', icon: TrendingUp },
  { href: '/virtual-portfolio', label: 'Virtual Portfolio', icon: Wallet },
];

/**
 * Top navigation bar with links and theme toggle
 */
export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-primary">Crypto</span>
            <span>MAESTRO</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === href
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
