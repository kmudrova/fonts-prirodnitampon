'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        <Link
          href="/admin/ambassadors"
          className={`flex flex-col items-center justify-center px-2 py-1 text-xs ${
            pathname.startsWith('/admin') ? 'text-green-600 font-semibold' : 'text-gray-500'
          }`}
        >
          <span className="text-lg mb-0.5">👥</span>
          Ambasadorky
        </Link>
        <Link
          href="/dashboard"
          className="flex flex-col items-center justify-center px-2 py-1 text-xs text-gray-500"
        >
          <span className="text-lg mb-0.5">📊</span>
          Dashboard
        </Link>
      </div>
    </nav>
  );
}
