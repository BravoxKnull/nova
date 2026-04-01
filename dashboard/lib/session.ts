import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardEnv } from "./env";
import {
  exchangeCodeForToken,
  fetchDiscordUser,
  refreshAccessToken,
  type DiscordTokenResponse,
  type DiscordUser,
} from "./discord";

const SESSION_COOKIE_NAME = "nova_session";
const LOGIN_STATE_COOKIE_NAME = "nova_login_state";
const encoder = new TextEncoder();

interface SessionPayload extends JWTPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: DiscordUser;
}

function getSessionKey(): Uint8Array {
  const dashboardEnv = getDashboardEnv();
  return encoder.encode(dashboardEnv.sessionSecret);
}

async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionKey());
}

async function verifySession(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSessionKey());

  return {
    accessToken: String(payload.accessToken),
    refreshToken: String(payload.refreshToken),
    expiresAt: Number(payload.expiresAt),
    user: payload.user as DiscordUser,
  };
}

function cookieBaseOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
    maxAge,
  };
}

export async function persistDiscordSession(token: DiscordTokenResponse): Promise<void> {
  const cookieStore = await cookies();
  const user = await fetchDiscordUser(token.access_token);
  const expiresAt = Date.now() + token.expires_in * 1000;

  const sessionToken = await signSession({
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt,
    user,
  });

  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, cookieBaseOptions(60 * 60 * 24 * 7));
}

export async function clearDiscordSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function createLoginState(): Promise<string> {
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(LOGIN_STATE_COOKIE_NAME, state, cookieBaseOptions(60 * 10));
  return state;
}

export async function assertLoginState(state: string): Promise<void> {
  const cookieStore = await cookies();
  const storedState = cookieStore.get(LOGIN_STATE_COOKIE_NAME)?.value;
  cookieStore.delete(LOGIN_STATE_COOKIE_NAME);

  if (!storedState || storedState !== state) {
    throw new Error("Invalid Discord OAuth state");
  }
}

async function refreshSession(session: SessionPayload): Promise<SessionPayload> {
  const refreshedToken = await refreshAccessToken(session.refreshToken);
  const refreshedUser = await fetchDiscordUser(refreshedToken.access_token);

  const nextSession: SessionPayload = {
    accessToken: refreshedToken.access_token,
    refreshToken: refreshedToken.refresh_token,
    expiresAt: Date.now() + refreshedToken.expires_in * 1000,
    user: refreshedUser,
  };

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    await signSession(nextSession),
    cookieBaseOptions(60 * 60 * 24 * 7),
  );

  return nextSession;
}

export async function getDashboardSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const session = await verifySession(token);
    if (Date.now() > session.expiresAt - 60_000) {
      return refreshSession(session);
    }

    return session;
  } catch {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }
}

export async function requireDashboardSession(): Promise<SessionPayload> {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/");
  }

  return session;
}

export async function createSessionFromAuthorizationCode(code: string): Promise<void> {
  const token = await exchangeCodeForToken(code);
  await persistDiscordSession(token);
}
