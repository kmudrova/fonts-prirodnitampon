'use client';

import { ReactNode } from 'react';
import LogoutButton from './LogoutButton';

interface PageShellProps {
  title: string;
  children: ReactNode;
  backHref?: string;
}

export default function PageShell({ title, children, backHref }: PageShellProps) {
  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        {backHref && (
          <a href={backHref} className="text-green-600 text-xl font-bold">
            ←
          </a>
        )}
        <h1 className="text-lg font-bold text-gray-900 flex-1">{title}</h1>
        <LogoutButton />
      </header>
      <main className="p-4 max-w-lg mx-auto">{children}</main>
    </div>
  );
}
