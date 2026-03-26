import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "atlas-session";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not set");
  return secret;
}

export function createToken(): string {
  return jwt.sign({ userId: 1 }, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    path: "/dashboard",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

export function clearCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/dashboard",
    maxAge: 0,
  };
}
