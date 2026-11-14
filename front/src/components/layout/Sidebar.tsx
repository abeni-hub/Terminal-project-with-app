'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/src/store/auth-store';
import { getNavItemsForPermissions } from '@/src/constants/navigation';
import { APP_SHORT_NAME, APP_TAGLINE } from '@/src/constants';
import { cn } from '@/lib/utils';
import { Bus, X, ChevronLeft } from 'lucide-react';
import { useUIStore } from '@/src/store/ui-store';
import { ScrollArea } from '@/components/ui/scroll-area';

export function Sidebar() {
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const mobileOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  if (!session || !session.permissions) return null;
  const items = getNavItemsForPermissions(session.permissions.map((p) => p.name));

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const content = (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center gap-3 border-b border-border px-4 py-4', collapsed && 'justify-center px-2')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bus className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{APP_SHORT_NAME}</p>
            <p className="truncate text-xs text-muted-foreground">{APP_TAGLINE}</p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-1">
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-2',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t border-border p-2">
        <button
          onClick={toggleSidebar}
          className="hidden w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground lg:flex"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-card transition-[width] duration-200 lg:block',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {content}
      </aside>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card lg:hidden">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
            {content}
          </aside>
        </>
      )}
    </>
  );
}
