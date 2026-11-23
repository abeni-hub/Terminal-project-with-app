'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/src/store/auth-store';
import { getRoleNavSections } from '@/src/constants/navigation';
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
  const sections = getRoleNavSections(
    session.role?.name,
    session.permissions.map((p) => p.name)
  );

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const content = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className={cn('flex items-center gap-3 border-b border-border px-4 py-4', collapsed && 'justify-center px-2')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Bus className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">{APP_SHORT_NAME}</p>
            <p className="truncate text-[11px] text-muted-foreground">{APP_TAGLINE}</p>
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-4">
          {sections.map((section, sIdx) => (
            <div key={section.title || sIdx} className="space-y-1">
              {!collapsed && (
                <div className="px-2 pt-2 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    {section.title}
                  </p>
                </div>
              )}
              {collapsed && sIdx > 0 && (
                <div className="my-2 border-t border-border/40" />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      title={collapsed ? `${section.title}: ${item.label}` : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                        collapsed && 'justify-center px-2',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <div className="flex flex-1 items-center justify-between overflow-hidden">
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* User Info / Role Badge */}
      {!collapsed && session.user && (
        <div className="border-t border-border px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
              style={{ backgroundColor: session.user.avatarColor || '#3b82f6' }}
            >
              {session.user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{session.user.name}</p>
              <p className="truncate text-[10px] text-muted-foreground font-medium">
                {session.role?.label || session.role?.name}
                {session.user.terminalName ? ` • ${session.user.terminalName}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="border-t border-border p-2">
        <button
          onClick={toggleSidebar}
          className="hidden w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground lg:flex"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && 'Collapse sidebar'}
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
