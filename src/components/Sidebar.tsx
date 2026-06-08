"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▥" },
  { href: "/inventory", label: "Inventory", icon: "▦" },
  { href: "/expenses", label: "Expenses", icon: "−" },
  { href: "/customers", label: "Customers", icon: "☺" },
  { href: "/leads", label: "Leads", icon: "✦" },
  { href: "/taxes", label: "Taxes (CA)", icon: "%" },
];

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...NAV, { href: "/settings/users", label: "Team", icon: "⚙" }]
    : NAV;

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="w-5 text-center opacity-80">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
