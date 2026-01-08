import { Inbox, Home, Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  icon: typeof Inbox;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/', icon: Inbox, label: 'Inbox' },
  { to: '/club', icon: Home, label: 'Club' },
  { to: '/browse', icon: Search, label: 'Browse' },
];

interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 h-16 bg-white border-t border-neutral-300',
        'flex items-center justify-around',
        'lg:hidden', // Hide on desktop
        className
      )}
      aria-label="Main navigation"
    >
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'touch-target flex flex-col items-center justify-center gap-1 px-4 py-2',
              'text-muted-foreground transition-colors',
              isActive && 'text-primary'
            )
          }
          aria-label={label}
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn('h-6 w-6', isActive && 'stroke-[2.5px]')}
                aria-hidden="true"
              />
              <span className="text-xs font-medium">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
