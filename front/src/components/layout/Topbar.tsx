'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/src/store/auth-store';
import { useUIStore } from '@/src/store/ui-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Menu, Sun, Moon, Bell, Search, LogOut, User as UserIcon, Settings, Command } from 'lucide-react';
import { api } from '@/src/services/api';
import { toast } from 'sonner';
import { useIsClient } from '@/src/hooks/useIsClient';

export function Topbar() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const session = useAuthStore((s) => s.session);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!session || !session.role) return null;
  const user = session.user;
  const role = session.role;
  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      console.warn('Logout failed:', e);
    } finally {
      clearSession();
      toast.success('Signed out successfully');
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur">
      {/* Left side: Mobile drawer toggle & Search command bar */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>

        <button
          onClick={() => setCommandOpen(true)}
          className="hidden w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span>Search or jump to...</span>
          <kbd className="ml-auto inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
      </div>

      {/* Right side: Theme toggle, Notifications bell, and User Account */}
      <div className="flex items-center gap-2 ml-auto">
        <Button variant="ghost" size="icon" onClick={() => setCommandOpen(true)} className="md:hidden">
          <Search className="h-5 w-5" />
        </Button>

        {mounted && isClient && (
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle Theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        )}

        <Button variant="ghost" size="icon" className="relative" onClick={() => toast.info('No new notifications')} title="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-muted focus:outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback style={{ backgroundColor: user.avatarColor ?? '#2176ff' }} className="text-xs font-medium text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{role.label}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <UserIcon className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
