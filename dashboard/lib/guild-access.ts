import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { getDashboardEnv } from "./env";

const GUILD_ACCESS_COOKIE_NAME = "nova_recent_guild_access";
const encoder = new TextEncoder();

interface RecentGuildAccessPayload extends JWTPayload {
  guildId: string;
  guildName: string;
}

function getGuildAccessKey(): Uint8Array {
  return encoder.encode(getDashboardEnv().sessionSecret);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
    maxAge,
  };
}

async function signGuildAccess(payload: RecentGuildAccessPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getGuildAccessKey());
}

export async function persistRecentGuildAccess(guildId: string, guildName: string): Promise<void> {
  const cookieStore = await cookies();
  const token = await signGuildAccess({ guildId, guildName });
  cookieStore.set(GUILD_ACCESS_COOKIE_NAME, token, cookieOptions(60 * 5));
}

export async function getRecentGuildAccess(
  guildId: string,
): Promise<{ guildId: string; guildName: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUILD_ACCESS_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getGuildAccessKey());
    if (String(payload.guildId) !== guildId) {
      return null;
    }

    return {
      guildId: String(payload.guildId),
      guildName: String(payload.guildName),
    };
  } catch {
    cookieStore.delete(GUILD_ACCESS_COOKIE_NAME);
    return null;
  }
}
