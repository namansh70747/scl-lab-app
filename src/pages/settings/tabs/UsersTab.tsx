import { useState } from "react";
import { promptDialog } from "@/lib/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, KeyRound, ShieldCheck, Shield, Users as UsersIcon } from "lucide-react";
import { Card, TabHeader, TextField, SelectField, PrimaryButton } from "../ui";
import { cn } from "@/lib/utils";
import { listUsers, createUser, adminResetPassword, setUserRole, setUserActive } from "@/lib/queries/auth";
import { useToast, errMessage } from "../toast";
import type { Role, User } from "@/types";

export function UsersTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const activeAdmins = users.filter((u) => u.role === "admin" && u.active === 1).length;

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["users"] });
  }

  // ── Add user form ──
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("technician");
  const [tempPw, setTempPw] = useState("");
  const [adding, setAdding] = useState(false);

  async function onAdd() {
    if (!username.trim() || !displayName.trim() || !tempPw) {
      toast.error("Username, display name and a temporary password are required.");
      return;
    }
    setAdding(true);
    try {
      await createUser(username.trim(), displayName.trim(), role, tempPw);
      toast.success(`User “${username.trim().toLowerCase()}” created.`);
      setUsername("");
      setDisplayName("");
      setRole("technician");
      setTempPw("");
      await refresh();
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setAdding(false);
    }
  }

  async function onResetPassword(u: User) {
    const pw = await promptDialog({ title: `Reset password`, message: `Set a new temporary password for “${u.username}”.`, password: true, confirmText: "Set password" });
    if (!pw) return;
    if (pw.length < 4) {
      toast.error("Password is too short.");
      return;
    }
    try {
      await adminResetPassword(u.id, pw);
      toast.success(`Password reset for “${u.username}”. They must change it on next login.`);
    } catch (e) {
      toast.error(errMessage(e));
    }
  }

  async function onToggleRole(u: User) {
    const next: Role = u.role === "admin" ? "technician" : "admin";
    // Don't demote the last active admin.
    if (u.role === "admin" && next === "technician" && u.active === 1 && activeAdmins <= 1) {
      toast.error("Cannot demote the last active admin.");
      return;
    }
    try {
      await setUserRole(u.id, next);
      toast.success(`“${u.username}” is now ${next}.`);
      await refresh();
    } catch (e) {
      toast.error(errMessage(e));
    }
  }

  async function onToggleActive(u: User) {
    const deactivating = u.active === 1;
    if (deactivating && u.role === "admin" && activeAdmins <= 1) {
      toast.error("Cannot deactivate the last active admin.");
      return;
    }
    try {
      await setUserActive(u.id, deactivating ? 0 : 1);
      toast.success(`“${u.username}” ${deactivating ? "deactivated" : "activated"}.`);
      await refresh();
    } catch (e) {
      toast.error(errMessage(e));
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <Card className="space-y-4">
        <TabHeader title="Add user" subtitle="New users must change their temporary password on first login." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Username" value={username} onChange={setUsername} placeholder="e.g. vicky" />
          <TextField label="Display name" value={displayName} onChange={setDisplayName} placeholder="e.g. Rajesh Kumar" />
          <SelectField
            label="Role"
            value={role}
            onChange={(v) => setRole(v as Role)}
            options={[
              { value: "technician", label: "Technician" },
              { value: "admin", label: "Admin" },
            ]}
          />
          <TextField label="Temporary password" type="password" value={tempPw} onChange={setTempPw} />
        </div>
        <div>
          <PrimaryButton onClick={onAdd} disabled={adding}>
            <UserPlus size={15} strokeWidth={1.8} />
            {adding ? "Adding…" : "Add user"}
          </PrimaryButton>
        </div>
      </Card>

      <div className="card overflow-hidden max-w-[640px]">
        <div className="px-6 pt-5 pb-4">
          <TabHeader title="Users" subtitle="Manage roles, passwords and access." />
        </div>
        {isLoading ? (
          <div className="px-6 pb-6 space-y-3">
            <div className="animate-pulse rounded-lg bg-[#eef0f4] h-4 w-3/4" />
            <div className="animate-pulse rounded-lg bg-[#eef0f4] h-4 w-2/3" />
            <div className="animate-pulse rounded-lg bg-[#eef0f4] h-4 w-1/2" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-11 h-11 rounded-xl bg-[#eef0f4] text-[#8a8b97] flex items-center justify-center mx-auto mb-3">
              <UsersIcon size={17} strokeWidth={1.8} />
            </div>
            <div className="text-[13.5px] text-[#8a8b97]">No users yet.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eef0f4]">
                  <th className="px-5 py-3 text-left table-head">User</th>
                  <th className="px-5 py-3 text-left table-head">Role</th>
                  <th className="px-5 py-3 text-left table-head">Active</th>
                  <th className="px-5 py-3 text-right table-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isLastAdmin = u.role === "admin" && u.active === 1 && activeAdmins <= 1;
                  return (
                    <tr key={u.id} className="group border-b border-[#f1f1f5] last:border-0 transition-colors hover:bg-[#fafafe]">
                      <td className="px-5 py-3 text-[13.5px]">
                        <div className="font-medium text-[#14151c]">{u.display_name}</div>
                        <div className="text-[12px] text-[#a3a5b3]">@{u.username}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "chip",
                            u.role === "admin" ? "bg-maroon-50 text-maroon-700" : "chip-blue"
                          )}
                        >
                          {u.role === "admin" ? "Admin" : "Technician"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <ToggleSwitch
                          checked={u.active === 1}
                          disabled={u.active === 1 && isLastAdmin}
                          label={u.active === 1 ? `Deactivate ${u.username}` : `Activate ${u.username}`}
                          onChange={() => onToggleActive(u)}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onResetPassword(u)}
                            className="btn btn-ghost px-2.5 py-1.5 text-[12.5px]"
                            title="Reset password"
                          >
                            <KeyRound size={14} strokeWidth={1.8} />
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleRole(u)}
                            disabled={isLastAdmin}
                            className="btn btn-ghost px-2.5 py-1.5 text-[12.5px]"
                            title={u.role === "admin" ? "Make technician" : "Make admin"}
                          >
                            {u.role === "admin" ? (
                              <Shield size={14} strokeWidth={1.8} />
                            ) : (
                              <ShieldCheck size={14} strokeWidth={1.8} />
                            )}
                            {u.role === "admin" ? "Make technician" : "Make admin"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-maroon-400 focus-visible:ring-offset-1",
        checked ? "bg-[#4f46e5]" : "bg-[#dcdde6]",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <span
        className={cn(
          "inline-block h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[16px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}
