import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  sessionDurationMs,
  type AppRole,
  type AuthAuditLog,
  type AuthSession,
  type PublicUser,
} from "@/lib/auth-types";

type AuthUser = PublicUser & {
  passwordHash: string;
};

type AuthState = {
  users: AuthUser[];
  auditLogs: AuthAuditLog[];
};

const authDbPath = path.join(process.cwd(), "data", "auth-db.json");

function nowText() {
  return new Date().toLocaleString("id-ID");
}

function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function defaultAuthState(): AuthState {
  const createdAt = nowText();

  return {
    users: [
      {
        id: "user-super-admin",
        username: "superadmin",
        passwordHash: hashPassword("testpassword"),
        name: "Super Admin",
        role: "super-admin",
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "user-admin",
        username: "admin",
        passwordHash: hashPassword("admin123"),
        name: "Admin",
        role: "admin",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    auditLogs: [
      {
        id: `audit-${Date.now()}`,
        actor: "system",
        action: "init",
        detail: "Default akun lokal dibuat.",
        createdAt,
      },
    ],
  };
}

function normalizeAuthState(state: Partial<AuthState>): AuthState {
  const fallback = defaultAuthState();
  const users =
    Array.isArray(state.users) && state.users.length > 0
      ? state.users
      : fallback.users;

  return {
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      passwordHash: user.passwordHash,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt || nowText(),
      updatedAt: user.updatedAt || nowText(),
    })),
    auditLogs: Array.isArray(state.auditLogs)
      ? state.auditLogs
      : fallback.auditLogs,
  };
}

async function readAuthState(): Promise<AuthState> {
  try {
    const raw = await readFile(authDbPath, "utf8");
    return normalizeAuthState(JSON.parse(raw) as Partial<AuthState>);
  } catch {
    const state = defaultAuthState();
    await writeAuthState(state);
    return state;
  }
}

async function writeAuthState(state: AuthState) {
  await mkdir(path.dirname(authDbPath), { recursive: true });
  await writeFile(authDbPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toSession(user: AuthUser): AuthSession {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    expiresAt: Date.now() + sessionDurationMs,
  };
}

function pushAudit(
  state: AuthState,
  actor: string,
  action: string,
  detail: string,
) {
  return {
    ...state,
    auditLogs: [
      {
        id: `audit-${Date.now()}-${randomUUID()}`,
        actor,
        action,
        detail,
        createdAt: nowText(),
      },
      ...state.auditLogs,
    ].slice(0, 200),
  };
}

function validateUserInput(
  input: {
    username?: string;
    name?: string;
    password?: string;
    role?: AppRole;
  },
  requirePassword: boolean,
) {
  const username = input.username?.trim();
  const name = input.name?.trim();
  const password = input.password ?? "";

  if (!username || !name || !input.role)
    return "Username, nama, dan role wajib diisi.";
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username))
    return "Username minimal 3 karakter dan hanya boleh huruf, angka, titik, garis bawah, atau strip.";
  if (requirePassword && password.length < 6)
    return "Password minimal 6 karakter.";
  if (input.role !== "admin" && input.role !== "super-admin")
    return "Role tidak valid.";

  return null;
}

export async function listAuthData() {
  const state = await readAuthState();

  return {
    users: state.users.map(toPublicUser),
    auditLogs: state.auditLogs,
  };
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<AuthSession | null> {
  let state = await readAuthState();
  const user = state.users.find(
    (item) => item.username.toLowerCase() === username.trim().toLowerCase(),
  );
  const ok = Boolean(user && user.passwordHash === hashPassword(password));

  state = pushAudit(
    state,
    username.trim() || "-",
    ok ? "login_success" : "login_failed",
    ok ? "Login berhasil." : "Percobaan login gagal.",
  );
  await writeAuthState(state);

  return ok && user ? toSession(user) : null;
}

export async function createUser(input: {
  username: string;
  name: string;
  password: string;
  role: AppRole;
  actor: string;
}) {
  let state = await readAuthState();
  const validation = validateUserInput(input, true);
  if (validation) return { ok: false, message: validation };

  const username = input.username.trim();
  if (
    state.users.some(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    )
  ) {
    return { ok: false, message: "Username sudah dipakai." };
  }

  const createdAt = nowText();
  const user: AuthUser = {
    id: `user-${Date.now()}`,
    username,
    name: input.name.trim(),
    role: input.role,
    passwordHash: hashPassword(input.password),
    createdAt,
    updatedAt: createdAt,
  };

  state = pushAudit(
    { ...state, users: [...state.users, user] },
    input.actor,
    "user_create",
    `User ${username} dibuat sebagai ${input.role}.`,
  );
  await writeAuthState(state);

  return {
    ok: true,
    message: "User berhasil ditambahkan.",
    users: state.users.map(toPublicUser),
    auditLogs: state.auditLogs,
  };
}

export async function updateUser(input: {
  id: string;
  username: string;
  name: string;
  role: AppRole;
  password?: string;
  actor: string;
}) {
  let state = await readAuthState();
  const target = state.users.find((user) => user.id === input.id);
  if (!target) return { ok: false, message: "User tidak ditemukan." };

  const validation = validateUserInput(input, false);
  if (validation) return { ok: false, message: validation };

  const username = input.username.trim();
  if (
    state.users.some(
      (user) =>
        user.id !== input.id &&
        user.username.toLowerCase() === username.toLowerCase(),
    )
  ) {
    return { ok: false, message: "Username sudah dipakai user lain." };
  }

  const nextRole = input.role;
  if (
    target.role === "super-admin" &&
    nextRole !== "super-admin" &&
    state.users.filter((user) => user.role === "super-admin").length <= 1
  ) {
    return { ok: false, message: "Minimal harus ada satu Super Admin." };
  }

  if (input.password && input.password.length < 6)
    return { ok: false, message: "Password minimal 6 karakter." };

  state = {
    ...state,
    users: state.users.map((user) =>
      user.id === input.id
        ? {
            ...user,
            username,
            name: input.name.trim(),
            role: nextRole,
            passwordHash: input.password
              ? hashPassword(input.password)
              : user.passwordHash,
            updatedAt: nowText(),
          }
        : user,
    ),
  };
  state = pushAudit(
    state,
    input.actor,
    "user_update",
    `User ${username} diperbarui${input.password ? " dan password diganti" : ""}.`,
  );
  await writeAuthState(state);

  return {
    ok: true,
    message: "User berhasil diperbarui.",
    users: state.users.map(toPublicUser),
    auditLogs: state.auditLogs,
  };
}

export async function deleteUser(input: { id: string; actor: string }) {
  let state = await readAuthState();
  const target = state.users.find((user) => user.id === input.id);
  if (!target) return { ok: false, message: "User tidak ditemukan." };
  if (
    target.role === "super-admin" &&
    state.users.filter((user) => user.role === "super-admin").length <= 1
  ) {
    return { ok: false, message: "Minimal harus ada satu Super Admin." };
  }

  state = pushAudit(
    { ...state, users: state.users.filter((user) => user.id !== input.id) },
    input.actor,
    "user_delete",
    `User ${target.username} dihapus.`,
  );
  await writeAuthState(state);

  return {
    ok: true,
    message: "User berhasil dihapus.",
    users: state.users.map(toPublicUser),
    auditLogs: state.auditLogs,
  };
}
