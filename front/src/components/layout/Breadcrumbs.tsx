'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { NAV_ITEMS } from '@/src/constants/navigation';

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg) => {
    const href = '/' + segments.slice(0, segments.indexOf(seg) + 1).join('/');
    const navItem = NAV_ITEMS.find((n) => n.href === href);
    const label = navItem?.label ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
    return { href, label };
  });

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((crumb, i) => (
        <Fragment key={crumb.href}>
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
