"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageGuild, fetchDiscordGuilds } from "../../../lib/discord";
import {
  createAlias,
  createAllowedSpeaker,
  deleteAlias,
  deleteAllowedSpeaker,
  type DashboardAllowedSpeakerType,
  type DashboardCommandName,
  type DashboardListenMode,
  updateCommandEnabled,
  updateGuildListenMode,
} from "../../../lib/guild-config";
import { getDashboardSession } from "../../../lib/session";

async function assertGuildAccess(guildId: string): Promise<void> {
  const session = await getDashboardSession();
  if (!session) {
    redirect(`/dashboard/${guildId}?error=session-required`);
  }

  const guilds = await fetchDiscordGuilds(session.accessToken);
  const guild = guilds.find((entry) => entry.id === guildId);
  if (!guild || !canManageGuild(guild)) {
    redirect(`/dashboard/${guildId}?error=forbidden`);
  }
}

function redirectWithStatus(guildId: string, key: "success" | "error", value: string): never {
  redirect(`/dashboard/${guildId}?${key}=${encodeURIComponent(value)}`);
}

export async function setListenModeAction(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  const listenMode = String(formData.get("listenMode") ?? "") as DashboardListenMode;

  await assertGuildAccess(guildId);

  if (!["AUTO", "MANUAL"].includes(listenMode)) {
    redirectWithStatus(guildId, "error", "invalid-listen-mode");
  }

  await updateGuildListenMode(guildId, listenMode);
  revalidatePath(`/dashboard/${guildId}`);
  redirectWithStatus(guildId, "success", "listen-mode-saved");
}

export async function setCommandEnabledAction(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  const commandName = String(formData.get("commandName") ?? "") as DashboardCommandName;
  const enabled = String(formData.get("enabled") ?? "") === "true";

  await assertGuildAccess(guildId);

  if (!["drag", "mute", "unmute", "disconnect"].includes(commandName)) {
    redirectWithStatus(guildId, "error", "invalid-command");
  }

  await updateCommandEnabled(guildId, commandName, enabled);
  revalidatePath(`/dashboard/${guildId}`);
  redirectWithStatus(guildId, "success", "command-updated");
}

export async function addAliasAction(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  const alias = String(formData.get("alias") ?? "");
  const commandName = String(formData.get("commandName") ?? "") as DashboardCommandName;

  await assertGuildAccess(guildId);

  try {
    await createAlias(guildId, alias, commandName);
    revalidatePath(`/dashboard/${guildId}`);
    redirectWithStatus(guildId, "success", "alias-added");
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      redirectWithStatus(guildId, "error", "alias-exists");
    }

    redirectWithStatus(guildId, "error", "alias-invalid");
  }
}

export async function deleteAliasAction(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  const aliasId = String(formData.get("aliasId") ?? "");

  await assertGuildAccess(guildId);
  await deleteAlias(guildId, aliasId);
  revalidatePath(`/dashboard/${guildId}`);
  redirectWithStatus(guildId, "success", "alias-deleted");
}

export async function addAllowedSpeakerAction(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  const type = String(formData.get("type") ?? "") as DashboardAllowedSpeakerType;
  const value = String(formData.get("value") ?? "");

  await assertGuildAccess(guildId);

  if (!["USER", "ROLE"].includes(type)) {
    redirectWithStatus(guildId, "error", "speaker-type-invalid");
  }

  try {
    await createAllowedSpeaker(guildId, type, value);
    revalidatePath(`/dashboard/${guildId}`);
    redirectWithStatus(guildId, "success", "allowed-speaker-added");
  } catch {
    redirectWithStatus(guildId, "error", "allowed-speaker-invalid");
  }
}

export async function deleteAllowedSpeakerAction(formData: FormData): Promise<void> {
  const guildId = String(formData.get("guildId") ?? "");
  const allowedSpeakerId = String(formData.get("allowedSpeakerId") ?? "");

  await assertGuildAccess(guildId);
  await deleteAllowedSpeaker(guildId, allowedSpeakerId);
  revalidatePath(`/dashboard/${guildId}`);
  redirectWithStatus(guildId, "success", "allowed-speaker-deleted");
}
