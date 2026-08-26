export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "ai_marks_auth_tokens";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function readTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(TOKEN_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthTokens;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

function writeTokens(tokens: AuthTokens): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export interface CurrentUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  status: string;
  lastLoginAt: string | null;
  professorProfile: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department: { id: string; code: string; name: string };
  } | null;
}

export interface DepartmentStudent {
  id: string;
  registerNumber: string;
  fullName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  status: string;
}

export interface DepartmentStudents {
  department: { id: string; code: string; name: string };
  students: DepartmentStudent[];
}

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error("Invalid username or password");
  writeTokens((await response.json()) as AuthTokens);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let tokens = readTokens();
  if (!tokens) throw new Error("No access token is available. Sign in before reviewing marks.");
  let response = await authorizedFetch(path, tokens.accessToken, init);
  if (response.status === 401) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!refreshed.ok) {
      localStorage.removeItem(TOKEN_KEY);
      throw new Error("Your session expired. Sign in again.");
    }
    tokens = (await refreshed.json()) as AuthTokens;
    writeTokens(tokens);
    response = await authorizedFetch(path, tokens.accessToken, init);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function authorizedFetch(path: string, accessToken: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });
}

export function hasStoredSession(): boolean {
  return readTokens() !== null;
}
