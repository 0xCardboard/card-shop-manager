import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Once any user exists, setup is closed.
  const count = await prisma.user.count();
  if (count > 0) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            CS
          </div>
          <h1 className="text-xl font-semibold">Create your admin account</h1>
          <p className="mt-1 text-sm text-slate-500">
            This one-time setup page closes after the first account is created.
          </p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}
