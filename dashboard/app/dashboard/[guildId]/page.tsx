import Link from "next/link";
import {
  buildDiscordInstallUrl,
  canManageGuild,
  fetchDiscordGuilds,
  isBotInstalledInGuild,
} from "../../../lib/discord";
import { getRecentGuildAccess } from "../../../lib/guild-access";
import { getOrCreateGuildDashboardConfig } from "../../../lib/guild-config";
import { getDashboardSession } from "../../../lib/session";
import {
  addAliasAction,
  addAllowedSpeakerAction,
  deleteAliasAction,
  deleteAllowedSpeakerAction,
  setCommandEnabledAction,
  setListenModeAction,
} from "./actions";

interface GuildSettingsPageProps {
  params: Promise<{
    guildId: string;
  }>;
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function GuildSettingsPage({
  params,
  searchParams,
}: GuildSettingsPageProps) {
  const { guildId } = await params;
  const query = await searchParams;
  const session = await getDashboardSession();

  if (!session) {
    return (
      <main className="shell page">
        <section className="dashboard-head">
          <div>
            <p className="eyebrow">Session required</p>
            <h1 className="page-title">Sign in to open guild settings.</h1>
            <p className="muted">
              This page needs your Discord session so NOVA can confirm which guild you are
              managing.
            </p>
          </div>
          <div className="row">
            <a className="button" href="/api/auth/discord/login">
              Log In With Discord
            </a>
            <Link className="button secondary" href="/">
              Back Home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  try {
    const recentGuildAccess = await getRecentGuildAccess(guildId);
    let guildName = recentGuildAccess?.guildName ?? "";

    if (!recentGuildAccess) {
      const guilds = await fetchDiscordGuilds(session.accessToken);
      const guild = guilds.find((entry) => entry.id === guildId);
      const canManage = guild ? canManageGuild(guild) : false;

      if (!guild || !canManage) {
        return (
          <main className="shell page">
            <section className="dashboard-head">
              <div>
                <p className="eyebrow">Access required</p>
                <h1 className="page-title">Guild unavailable</h1>
                <p className="muted">
                  NOVA could not verify that your Discord account can manage this guild.
                </p>
              </div>
              <div className="row">
                <Link className="button secondary" href="/dashboard">
                  Back to Guilds
                </Link>
              </div>
            </section>
          </main>
        );
      }

      guildName = guild.name;
    }

    const botInstalled = await isBotInstalledInGuild(guildId);
    if (!botInstalled) {
      return (
        <main className="shell page">
          <section className="dashboard-head">
            <div>
              <p className="eyebrow">Invite required</p>
              <h1 className="page-title">Invite NOVA before editing settings</h1>
              <p className="muted">
                This guild cannot be configured until NOVA has been added to the server. Finish the
                install first, then come back here.
              </p>
            </div>
            <div className="row">
              <a className="button" href={buildDiscordInstallUrl(guildId)} target="_blank" rel="noreferrer">
                Invite NOVA
              </a>
              <Link className="button secondary" href="/dashboard">
                Back to Guilds
              </Link>
            </div>
          </section>
        </main>
      );
    }

    const config = await getOrCreateGuildDashboardConfig(guildId);

    return (
      <main className="shell page">
        <section className="dashboard-head">
          <div>
            <p className="eyebrow">Guild Configuration</p>
            <h1 className="page-title">{guildName}</h1>
            <p className="muted">
              Default records are created automatically the first time this page opens. From here,
              server owners can change command behavior, aliases, and the list of allowed speakers.
            </p>
          </div>

          <div className="row">
            <Link className="button secondary" href="/dashboard">
              Back to Guilds
            </Link>
          </div>
        </section>

        {query.success ? (
          <div className="feedback-banner success-banner">
            Saved: {query.success.replace(/-/g, " ")}
          </div>
        ) : null}
        {query.error ? (
          <div className="feedback-banner error-banner">
            Error: {query.error.replace(/-/g, " ")}
          </div>
        ) : null}

        <section className="grid guild-settings-grid">
          <article className="detail-card">
            <h3>Default Behavior</h3>
            <div className="detail-list">
              <div>
                <strong>Guild ID</strong>
                <span className="muted">{guildId}</span>
              </div>
              <div>
                <strong>Default configuration</strong>
                <span className="muted">
                  NOVA creates a guild row, guild settings, and all built-in commands the first
                  time this page is opened.
                </span>
              </div>
              <div>
                <strong>Listen mode</strong>
                <span className="muted">
                  AUTO follows eligible speakers automatically. MANUAL keeps the setting ready for
                  a future explicit join workflow.
                </span>
              </div>
            </div>

            <div className="form-section">
              <form action={setListenModeAction} className="inline-form">
                <input type="hidden" name="guildId" value={guildId} />
                <input type="hidden" name="listenMode" value="AUTO" />
                <button
                  className={config.listenMode === "AUTO" ? "button" : "button secondary"}
                  type="submit"
                >
                  Set AUTO
                </button>
              </form>

              <form action={setListenModeAction} className="inline-form">
                <input type="hidden" name="guildId" value={guildId} />
                <input type="hidden" name="listenMode" value="MANUAL" />
                <button
                  className={config.listenMode === "MANUAL" ? "button" : "button secondary"}
                  type="submit"
                >
                  Set MANUAL
                </button>
              </form>
            </div>
          </article>

          <article className="detail-card">
            <h3>Command Toggles</h3>
            <div className="stack-list">
              {config.commands.map((command) => (
                <div key={command.commandName} className="config-row">
                  <div>
                    <strong>{command.commandName}</strong>
                    <div className="muted">
                      {command.enabled ? "Enabled for this guild" : "Disabled for this guild"}
                    </div>
                  </div>

                  <form action={setCommandEnabledAction} className="inline-form">
                    <input type="hidden" name="guildId" value={guildId} />
                    <input type="hidden" name="commandName" value={command.commandName} />
                    <input type="hidden" name="enabled" value={String(!command.enabled)} />
                    <button className="button secondary" type="submit">
                      {command.enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </article>

          <article className="detail-card">
            <h3>Aliases</h3>
            <p className="muted">
              Aliases are per guild and map a single spoken keyword to one built-in moderation
              command.
            </p>

            <form action={addAliasAction} className="stack-form">
              <input type="hidden" name="guildId" value={guildId} />
              <label className="field">
                <span>Alias keyword</span>
                <input name="alias" type="text" placeholder="move" required />
              </label>
              <label className="field">
                <span>Command</span>
                <select name="commandName" defaultValue="drag">
                  <option value="drag">drag</option>
                  <option value="mute">mute</option>
                  <option value="unmute">unmute</option>
                  <option value="disconnect">disconnect</option>
                </select>
              </label>
              <button className="button" type="submit">
                Add Alias
              </button>
            </form>

            {config.aliases.length === 0 ? (
              <div className="empty-inline">
                No aliases configured. The built-in command words are active by default.
              </div>
            ) : (
              <div className="stack-list">
                {config.aliases.map((alias) => (
                  <div key={alias.id} className="config-row">
                    <div>
                      <strong>{alias.alias}</strong>
                      <div className="muted">Maps to {alias.commandName}</div>
                    </div>
                    <form action={deleteAliasAction} className="inline-form">
                      <input type="hidden" name="guildId" value={guildId} />
                      <input type="hidden" name="aliasId" value={alias.id} />
                      <button className="button secondary" type="submit">
                        Delete
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="detail-card">
            <h3>Allowed Speakers</h3>
            <p className="muted">
              NOVA only listens to configured users or roles. Use Discord IDs for now.
            </p>

            <form action={addAllowedSpeakerAction} className="stack-form">
              <input type="hidden" name="guildId" value={guildId} />
              <label className="field">
                <span>Type</span>
                <select name="type" defaultValue="USER">
                  <option value="USER">User ID</option>
                  <option value="ROLE">Role ID</option>
                </select>
              </label>
              <label className="field">
                <span>Discord ID</span>
                <input name="value" type="text" placeholder="123456789012345678" required />
              </label>
              <button className="button" type="submit">
                Add Allowed Speaker
              </button>
            </form>

            {config.allowedSpeakers.length === 0 ? (
              <div className="empty-inline">
                No speakers configured yet. Add at least one user or role before expecting NOVA to
                act on voice commands.
              </div>
            ) : (
              <div className="stack-list">
                {config.allowedSpeakers.map((allowedSpeaker) => (
                  <div key={allowedSpeaker.id} className="config-row">
                    <div>
                      <strong>{allowedSpeaker.type}</strong>
                      <div className="muted">{allowedSpeaker.value}</div>
                    </div>
                    <form action={deleteAllowedSpeakerAction} className="inline-form">
                      <input type="hidden" name="guildId" value={guildId} />
                      <input
                        type="hidden"
                        name="allowedSpeakerId"
                        value={allowedSpeaker.id}
                      />
                      <button className="button secondary" type="submit">
                        Delete
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="detail-card">
            <h3>Recent Logs</h3>
            {config.recentLogs.length === 0 ? (
              <div className="empty-inline">No command logs yet for this guild.</div>
            ) : (
              <div className="stack-list">
                {config.recentLogs.map((log) => (
                  <div key={log.id} className="log-row">
                    <div>
                      <strong>{log.rawText}</strong>
                      <div className="muted">
                        Speaker {log.speakerId} - {log.createdAt.toLocaleString()}
                      </div>
                    </div>
                    <span className={log.success ? "pill success" : "pill warn"}>
                      {log.success ? "Success" : "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      </main>
    );
  } catch (error) {
    console.error("Guild settings page render failed", { guildId, error });

    return (
      <main className="shell page">
        <section className="dashboard-head">
          <div>
            <p className="eyebrow">Temporary issue</p>
            <h1 className="page-title">Guild settings could not load</h1>
            <p className="muted">
              The last change may still have been saved, but the dashboard could not refresh this
              page cleanly. Please reload once and try again.
            </p>
          </div>
          <div className="row">
            <Link className="button secondary" href={`/dashboard/${guildId}`}>
              Reload Page
            </Link>
            <Link className="button secondary" href="/dashboard">
              Back to Guilds
            </Link>
          </div>
        </section>
      </main>
    );
  }
}
