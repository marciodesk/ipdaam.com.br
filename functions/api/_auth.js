const cookieName = "etda_session";
const sessionMaxAge = 60 * 60 * 8;

function base64UrlEncode(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || "";
}

function getSecret(env) {
  const secret = env.SESSION_SECRET || env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("Variavel ADMIN_PASSWORD nao configurada.");
  }
  return secret;
}

async function sign(value, env) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createSessionCookie(access, env) {
  const now = Math.floor(Date.now() / 1000);
  const sessionAccess = typeof access === "string" ? { role: access } : access;
  const payload = base64UrlEncode(JSON.stringify({
    ...sessionAccess,
    iat: now,
    exp: now + sessionMaxAge,
  }));
  const signature = await sign(payload, env);
  return `${cookieName}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionMaxAge}`;
}

export function clearSessionCookie() {
  return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function authenticatePassword(password, env) {
  if (!env.ADMIN_PASSWORD) {
    throw new Error("Variavel ADMIN_PASSWORD nao configurada.");
  }
  if (password === env.ADMIN_PASSWORD) return { role: "admin" };
  if (env.USER_PASSWORD && password === env.USER_PASSWORD) return { role: "usuario" };
  return null;
}

export async function hashPassword(password, salt = crypto.randomUUID()) {
  const data = new TextEncoder().encode(`${salt}:${String(password || "")}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `${salt}:${base64UrlEncode(new Uint8Array(digest))}`;
}

export async function verifyPassword(password, storedHash) {
  const [salt] = String(storedHash || "").split(":");
  if (!salt) return false;
  return await hashPassword(password, salt) === storedHash;
}

export async function getAccess(request, env) {
  const token = getCookie(request, cookieName);
  if (token) {
    const [payload, signature] = token.split(".");
    if (payload && signature && signature === await sign(payload, env)) {
      const session = JSON.parse(base64UrlDecode(payload));
      if (session.exp && session.exp > Math.floor(Date.now() / 1000)) {
        return session;
      }
    }
  }

  return null;
}

export async function requireAdmin(request, env) {
  const access = await getAccess(request, env);
  return access && access.role === "admin";
}
