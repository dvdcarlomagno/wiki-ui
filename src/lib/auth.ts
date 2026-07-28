import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "wiki_session";
const SESSION_TTL = "7d";

function secretKey() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.APP_PASSWORD ||
    "dev-only-change-me";
  return new TextEncoder().encode(secret);
}

export function getAppPassword() {
  const password = process.env.APP_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "APP_PASSWORD is not configured. Set it in your environment variables.",
    );
  }
  return password;
}

export async function createSessionToken() {
  return new SignJWT({ role: "operator" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey());
}

export async function verifySessionToken(token: string) {
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export async function isAuthenticated() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

export async function requireAuth() {
  const ok = await isAuthenticated();
  if (!ok) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}
