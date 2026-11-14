'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/src/store/auth-store';
import { getNavItemsForPermissions } from '@/src/constants/navigation';
import { useUIStore } from '@/src/store/ui-store';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useEffect } from 'react';

export function CommandPalette() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  if (!session || !session.permissions) return null;
  const items = getNavItemsForPermissions(session.permissions.map((p) => p.name));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {items.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => {
                router.push(item.href);
                setOpen(false);
              }}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
              {item.description && <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
