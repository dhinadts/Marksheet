export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error("Invalid username or password");
  const tokens = (await response.json()) as { accessToken: string };
  sessionStorage.setItem("ai_marks_access_token", tokens.accessToken);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem("ai_marks_access_token");
  if (!token) throw new Error("No access token is available. Sign in before reviewing marks.");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
