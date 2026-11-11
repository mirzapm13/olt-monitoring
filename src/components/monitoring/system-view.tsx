"use client";

import { Pencil, Power, Save, Shield, Trash2, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import {
  authStorageKey,
  roleDescriptions,
  roleLabels,
  type AppRole,
  type AuthAuditLog,
  type AuthSession,
  type PublicUser,
} from "@/lib/auth-types";
import { SelectInput, TextInput } from "./ui-primitives";
import {
  panelClass,
  secondaryButtonClass,
  type StartupStatus,
  type ToastTone,
} from "./workspace-types";
import { startupDescription, startupPlatformLabel } from "./workspace-utils";

export function SystemView({
  onResetDefault,
  onToast,
}: {
  onResetDefault: () => void;
  onToast: (message: string, tone?: ToastTone) => void;
}) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuthAuditLog[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [systemMessage, setSystemMessage] = useState("");
  const [startupStatus, setStartupStatus] = useState<StartupStatus>({
    enabled: false,
  });
  const [userForm, setUserForm] = useState({
    username: "",
    name: "",
    password: "",
    role: "admin" as AppRole,
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/users")
      .then(
        (response) =>
          response.json() as Promise<{
            users: PublicUser[];
            auditLogs: AuthAuditLog[];
          }>,
      )
      .then((result) => {
        if (cancelled) return;
        setUsers(result.users);
        setAuditLogs(result.auditLogs);
      })
      .catch(() => {
        if (cancelled) return;
        setUsers([]);
        setAuditLogs([]);
        setSystemMessage("Data user belum bisa dibaca.");
      });

    fetch("/api/system/startup")
      .then((response) => response.json() as Promise<StartupStatus>)
      .then((result) => {
        if (!cancelled) setStartupStatus(result);
      })
      .catch(() => {
        if (!cancelled)
          setStartupStatus({
            enabled: false,
            message: "Status startup belum bisa dibaca.",
          });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function currentActor() {
    try {
      const raw = window.localStorage.getItem(authStorageKey);
      if (!raw) return "unknown";
      const session = JSON.parse(raw) as AuthSession;
      return session.username;
    } catch {
      return "unknown";
    }
  }

  function updateSystemData(result: {
    users?: PublicUser[];
    auditLogs?: AuthAuditLog[];
    message?: string;
  }) {
    if (result.users) setUsers(result.users);
    if (result.auditLogs) setAuditLogs(result.auditLogs);
    if (result.message) setSystemMessage(result.message);
  }

  function clearUserForm() {
    setEditingUserId(null);
    setUserForm({ username: "", name: "", password: "", role: "admin" });
  }

  function editUser(user: PublicUser) {
    setEditingUserId(user.id);
    setUserForm({
      username: user.username,
      name: user.name,
      password: "",
      role: user.role,
    });
    setSystemMessage(
      `Mode edit aktif untuk ${user.username}. Isi password baru jika ingin mengganti password.`,
    );
  }

  async function saveUser() {
    const payload = {
      ...userForm,
      id: editingUserId ?? "",
      actor: currentActor(),
    };
    const response = await fetch("/api/auth/users", {
      method: editingUserId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as {
      ok: boolean;
      message: string;
      users?: PublicUser[];
      auditLogs?: AuthAuditLog[];
    };

    updateSystemData(result);
    if (result.ok) clearUserForm();
  }

  async function removeUser(user: PublicUser) {
    const approved = window.confirm(`Hapus user ${user.username}?`);
    if (!approved) return;

    const response = await fetch("/api/auth/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, actor: currentActor() }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      message: string;
      users?: PublicUser[];
      auditLogs?: AuthAuditLog[];
    };

    updateSystemData(result);
    if (result.ok && editingUserId === user.id) clearUserForm();
  }

  function resetDefault() {
    const approved = window.confirm(
      "Reset Default akan mengosongkan data OLT, ONU/ONT, alert, dan setting Telegram. Akun login tetap tersedia. Lanjutkan?",
    );
    if (approved) onResetDefault();
  }

  async function toggleStartup() {
    const nextMethod = startupStatus.enabled ? "DELETE" : "POST";
    const loadingMessage = startupStatus.enabled
      ? "Menonaktifkan startup otomatis..."
      : "Mengaktifkan startup otomatis...";

    onToast(loadingMessage, "info");

    try {
      const response = await fetch("/api/system/startup", {
        method: nextMethod,
      });
      const result = (await response.json()) as StartupStatus;
      const message = result.message ?? "Status startup diperbarui.";

      setStartupStatus(result);
      onToast(message, response.ok ? "success" : "error");
    } catch (error) {
      onToast(
        error instanceof Error
          ? `Startup otomatis gagal: ${error.message}`
          : "Startup otomatis gagal diperbarui.",
        "error",
      );
    }
  }

  const roleAccess: Array<{ role: AppRole; access: string[]; tone: string }> = [
    {
      role: "admin",
      access: ["Dashboard", "OLT", "ONU/ONT", "Alert"],
      tone: "border-cyan-200 bg-cyan-50/70 text-cyan-900 dark:bg-cyan-950/25 dark:text-cyan-50",
    },
    {
      role: "super-admin",
      access: ["Semua menu", "Setting Telegram", "System", "Reset Default"],
      tone: "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-50",
    },
  ];

  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-950">System</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola role akses, akun lokal, dan reset default aplikasi.
          </p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-cyan-400 text-slate-950 shadow-lg shadow-violet-500/20">
          <Shield className="h-6 w-6" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white/60 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                <UserCog className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-950">
                  Akun dan Role
                </p>
                <p className="text-xs text-slate-500">
                  Akun lokal untuk masuk ke Mikroin Monitor.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 2xl:grid-cols-[1fr_360px]">
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-1">
                {users.map((user) => {
                  const isLastSuperAdmin =
                    user.role === "super-admin" &&
                    users.filter((item) => item.role === "super-admin")
                      .length <= 1;

                  return (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-950">
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            @{user.username}
                          </p>
                        </div>
                        <span className="rounded-xl border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-800">
                          {roleLabels[user.role]}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-600">
                        {roleDescriptions[user.role]}
                      </p>
                      {isLastSuperAdmin && (
                        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                          Super Admin terakhir
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className={secondaryButtonClass}
                          type="button"
                          onClick={() => editUser(user)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white"
                          type="button"
                          disabled={isLastSuperAdmin}
                          title={
                            isLastSuperAdmin
                              ? "Super Admin terakhir tidak bisa dihapus"
                              : "Hapus user"
                          }
                          onClick={() => void removeUser(user)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {isLastSuperAdmin ? "Tidak bisa dihapus" : "Hapus"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm dark:bg-violet-950/20">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between 2xl:flex-col">
                  <div>
                    <p className="text-sm font-bold text-slate-950">
                      {editingUserId ? "Edit User" : "Tambah User"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {editingUserId
                        ? "Kosongkan password jika tidak ingin mengganti password."
                        : "Buat akun lokal baru untuk operator."}
                    </p>
                  </div>
                  {editingUserId && (
                    <button
                      className={secondaryButtonClass}
                      type="button"
                      onClick={clearUserForm}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
                <div className="mt-4 grid gap-3">
                  <TextInput
                    label="Username"
                    value={userForm.username}
                    onChange={(value) =>
                      setUserForm((current) => ({
                        ...current,
                        username: value,
                      }))
                    }
                    placeholder="teknisi01"
                  />
                  <TextInput
                    label="Nama"
                    value={userForm.name}
                    onChange={(value) =>
                      setUserForm((current) => ({ ...current, name: value }))
                    }
                    placeholder="Teknisi Area"
                  />
                  <TextInput
                    label={
                      editingUserId ? "Password Baru (opsional)" : "Password"
                    }
                    value={userForm.password}
                    onChange={(value) =>
                      setUserForm((current) => ({
                        ...current,
                        password: value,
                      }))
                    }
                    placeholder={
                      editingUserId
                        ? "Isi untuk ganti password"
                        : "Minimal 6 karakter"
                    }
                    type="password"
                  />
                  <SelectInput
                    label="Role"
                    value={userForm.role}
                    options={["admin", "super-admin"]}
                    onChange={(value) =>
                      setUserForm((current) => ({
                        ...current,
                        role: value as AppRole,
                      }))
                    }
                  />
                </div>
                <button
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-700 to-cyan-700 px-4 text-sm font-bold text-white shadow-lg shadow-violet-900/20 transition hover:from-violet-600 hover:to-cyan-600"
                  type="button"
                  onClick={() => void saveUser()}
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {editingUserId ? "Simpan User" : "Tambah User"}
                </button>
                {systemMessage && (
                  <p className="mt-3 rounded-2xl border border-violet-300 bg-violet-100 p-3 text-sm font-semibold leading-6 text-violet-950 shadow-sm dark:border-violet-400/30 dark:bg-violet-950/45 dark:text-violet-50">
                    {systemMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <p className="text-sm font-bold text-slate-950">Hak Akses Role</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {roleAccess.map((item) => (
                  <div
                    key={item.role}
                    className={`rounded-2xl border p-4 ${item.tone}`}
                  >
                    <p className="text-sm font-extrabold">
                      {roleLabels[item.role]}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.access.map((access) => (
                        <span
                          key={access}
                          className="rounded-full border border-current/20 bg-white/45 px-2.5 py-1 text-xs font-bold"
                        >
                          {access}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm dark:bg-emerald-950/20">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                <Power className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-50">
                  Jalankan saat startup
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-200">
                  Platform: {startupPlatformLabel(startupStatus)} | Status:{" "}
                  {startupStatus.enabled ? "Aktif" : "Nonaktif"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-emerald-800 dark:text-emerald-100">
              {startupDescription(startupStatus)}
            </p>
            {startupStatus.path && (
              <p className="mt-2 break-all text-xs text-emerald-700 dark:text-emerald-200">
                {startupStatus.path}
              </p>
            )}
            {startupStatus.supported === "automatic" && (
              <button
                className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold text-white shadow-lg transition ${
                  startupStatus.enabled
                    ? "bg-slate-700 shadow-slate-900/20 hover:bg-slate-600"
                    : "bg-emerald-700 shadow-emerald-900/20 hover:bg-emerald-600"
                }`}
                type="button"
                onClick={() => void toggleStartup()}
              >
                <Power className="h-4 w-4" aria-hidden="true" />
                {startupStatus.enabled
                  ? "Nonaktifkan Startup"
                  : "Aktifkan Startup"}
              </button>
            )}
            {startupStatus.supported === "manual" && startupStatus.linux && (
              <div className="mt-4 space-y-3">
                <button
                  className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold text-white shadow-lg transition ${
                    startupStatus.enabled
                      ? "bg-slate-700 shadow-slate-900/20 hover:bg-slate-600"
                      : "bg-emerald-700 shadow-emerald-900/20 hover:bg-emerald-600"
                  }`}
                  type="button"
                  onClick={() => void toggleStartup()}
                >
                  <Power className="h-4 w-4" aria-hidden="true" />
                  {startupStatus.enabled
                    ? "Nonaktifkan Startup Linux"
                    : "Install Startup Otomatis"}
                </button>
                <div className="rounded-2xl border border-emerald-200 bg-white/70 p-3">
                  <p className="text-xs font-bold text-emerald-900">
                    Command aktifkan systemd
                  </p>
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs text-emerald-100">
                    {startupStatus.linux.commands.join("\n\n")}
                  </pre>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                  <p className="text-xs font-bold text-slate-900">
                    Command nonaktifkan
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
                    {startupStatus.linux.disableCommands.join("\n")}
                  </pre>
                </div>
              </div>
            )}
            {startupStatus.supported === "unsupported" && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Platform ini belum didukung otomatis. Gunakan service manager
                bawaan OS.
              </p>
            )}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/60 p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-950">Audit Log</p>
            <p className="mt-1 text-xs text-slate-500">
              Aktivitas login dan perubahan user terbaru.
            </p>
            <div className="mt-4 max-h-80 space-y-2 overflow-auto pr-1">
              {auditLogs.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  Belum ada audit log.
                </p>
              ) : (
                auditLogs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-slate-200 bg-white/70 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-950">
                        {log.action}
                      </span>
                      <span className="text-slate-400">{log.createdAt}</span>
                    </div>
                    <p className="mt-1 text-slate-600">{log.detail}</p>
                    <p className="mt-1 font-semibold text-cyan-700">
                      Actor: {log.actor}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-red-200 bg-red-50/70 p-5 shadow-sm dark:bg-red-950/20">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-red-700 shadow-sm">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-red-900 dark:text-red-50">
                  Reset Default
                </p>
                <p className="text-xs text-red-700 dark:text-red-200">
                  Mengosongkan database monitoring lokal.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-red-800 dark:text-red-100">
              Data OLT, ONU/ONT, alert, dan setting Telegram akan kembali
              kosong. Akun login tetap bisa digunakan.
            </p>
            <button
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition hover:bg-red-600"
              type="button"
              onClick={resetDefault}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Reset Default
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
