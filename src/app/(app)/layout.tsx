import Sidebar from "@/components/Sidebar";
import { requireSession } from "@/lib/session";
import { logout } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const admin = session.user.role === "ADMIN";

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            CS
          </div>
          <span className="font-semibold">Card Shop</span>
        </div>
        <Sidebar isAdmin={admin} />
        <div className="mt-auto border-t border-slate-200 p-3">
          <div className="mb-2 px-3 text-xs text-slate-500">
            <div className="font-medium text-slate-700">
              {session.user.name}
            </div>
            <div>{session.user.email}</div>
            <span className="badge mt-1 bg-slate-100 text-slate-600">
              {session.user.role}
            </span>
          </div>
          <form action={logout}>
            <button className="btn-secondary w-full" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}
