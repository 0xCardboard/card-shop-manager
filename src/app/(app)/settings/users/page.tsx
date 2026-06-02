import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { fmtDate } from "@/lib/utils";
import {
  createUser,
  deleteUser,
  resetPassword,
  setUserActive,
} from "./actions";

export default async function UsersPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Invite-only access. Add team members and control their roles."
      />

      <div className="card mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          Add a team member
        </h2>
        <form
          action={createUser}
          className="grid grid-cols-1 gap-3 sm:grid-cols-5"
        >
          <div className="sm:col-span-1">
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Jane" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Email</label>
            <input
              name="email"
              type="email"
              required
              className="input"
              placeholder="jane@example.com"
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue="STAFF">
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Temp password</label>
            <input
              name="password"
              type="text"
              required
              minLength={8}
              className="input"
              placeholder="min 8 chars"
            />
          </div>
          <div className="sm:col-span-5">
            <button className="btn-primary" type="submit">
              Add member
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Name</th>
              <th className="th">Email</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">Added</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="td font-medium">{u.name}</td>
                <td className="td">{u.email}</td>
                <td className="td">
                  <span className="badge bg-slate-100 text-slate-600">
                    {u.role}
                  </span>
                </td>
                <td className="td">
                  {u.active ? (
                    <span className="badge bg-green-100 text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="badge bg-red-100 text-red-600">
                      Disabled
                    </span>
                  )}
                </td>
                <td className="td">{fmtDate(u.createdAt)}</td>
                <td className="td">
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={setUserActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={(!u.active).toString()}
                      />
                      <button className="btn-secondary py-1 text-xs">
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    </form>
                    <form action={resetPassword} className="flex gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <input
                        name="password"
                        type="text"
                        placeholder="new pw"
                        minLength={8}
                        className="input w-24 py-1 text-xs"
                      />
                      <button className="btn-secondary py-1 text-xs">
                        Reset
                      </button>
                    </form>
                    <form action={deleteUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="btn-danger py-1 text-xs">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
