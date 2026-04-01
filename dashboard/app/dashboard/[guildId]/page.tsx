import Link from "next/link";
import { fetchDiscordGuilds } from "../../../lib/discord";
import { getDashboardSession } from "../../../lib/session";

interface GuildSettingsPageProps {
  params: Promise<{
    guildId: string;
  }>;
}

export default async function GuildSettingsPage({
  params,
}: GuildSettingsPageProps) {
  const { guildId } = await params;
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
  const guilds = await fetchDiscordGuilds(session.accessToken);
  const guild = guilds.find((entry) => entry.id === guildId);

  return (
    <main className="shell page">
      <section className="dashboard-head">
        <div>
          <p className="eyebrow">Guild Configuration</p>
          <h1 className="page-title">{guild?.name ?? "Guild not found"}</h1>
          <p className="muted">
            This page is the control-plane entry point for aliases, allowed speakers, command
            toggles, and audit views.
          </p>
        </div>

        <div className="row">
          <Link className="button secondary" href="/dashboard">
            Back to Guilds
          </Link>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <article className="detail-card">
          <h3>Bot Install</h3>
          <div className="detail-list">
            <div>
              <strong>Status</strong>
              <span className="muted">Use the dashboard Invite action first, then store installation state here.</span>
            </div>
            <div>
              <strong>Guild ID</strong>
              <span className="muted">{guildId}</span>
            </div>
          </div>
        </article>

        <article className="detail-card">
          <h3>Moderation Rules</h3>
          <div className="detail-list">
            <div>
              <strong>Allowed Speakers</strong>
              <span className="muted">Planned database-backed editor</span>
            </div>
            <div>
              <strong>Aliases</strong>
              <span className="muted">Planned database-backed editor</span>
            </div>
            <div>
              <strong>Commands</strong>
              <span className="muted">Planned enable/disable toggles</span>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
