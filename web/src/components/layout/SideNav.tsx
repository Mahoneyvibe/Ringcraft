import { Inbox, Home, Search, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  to: string;
  icon: typeof Inbox;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/', icon: Inbox, label: 'Inbox' },
  { to: '/club', icon: Home, label: 'My Club' },
  { to: '/browse', icon: Search, label: 'Browse' },
];

interface SideNavProps {
  className?: string;
}

export function SideNav({ className }: SideNavProps) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Error is handled in AuthContext
    }
  };

  return (
    <nav
      className={cn(
        'hidden lg:flex flex-col w-64 bg-white border-r border-neutral-300',
        'h-[calc(100vh-3.5rem)]', // Full height minus AIBar
        className
      )}
      aria-label="Main navigation"
    >
      {/* Navigation links */}
      <div className="flex-1 py-4">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 mx-2 rounded-md',
                'text-muted-foreground transition-colors',
                'hover:bg-muted hover:text-foreground',
                isActive && 'bg-primary/10 text-primary font-medium'
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {/* User section */}
      <div className="border-t border-neutral-300 p-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.displayName || user.email}
              </p>
              {user.displayName && (
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="touch-target p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
