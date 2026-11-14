import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/src/providers/app-providers';

export const metadata: Metadata = {
  title: 'AATO Roster System',
  description: 'Addis Ababa Transport Office Terminal Digital Roster System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

