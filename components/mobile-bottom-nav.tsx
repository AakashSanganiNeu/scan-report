'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', label: 'Dashboard' },
  { href: '/#entries', label: 'Entries' },
  { href: '/#prices', label: 'Prices' },
  { href: '/#categories', label: 'Categories' },
  { href: '/#history', label: 'History' },
  { href: '/account', label: 'Account' },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith('/auth')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white md:hidden">
      <ul className="grid grid-cols-6">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link href={tab.href} className={`block py-3 text-center text-xs ${pathname === tab.href ? 'text-indigo-700 font-semibold' : 'text-slate-600'}`}>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
