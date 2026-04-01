import Link from "next/link";
import { getDashboardSession } from "../lib/session";

export default async function LandingPage() {
  const session = await getDashboardSession();

  return (
    <main className="shell page">
      <section className="hero">
        <div className="panel hero-main">
          <span className="eyebrow">Discord OAuth + Server Install Flow</span>
          <h1>Deploy NOVA once. Let servers install and manage it safely.</h1>
          <p>
            This dashboard handles Discord login, server discovery, and bot installation links
            so server owners can connect NOVA to their guilds before configuring aliases,
            speakers, and moderation rules.
          </p>

          <div className="hero-actions" style={{ marginTop: "1.5rem" }}>
            {session ? (
              <Link className="button" href="/dashboard">
                Open Dashboard
              </Link>
            ) : (
              <Link className="button" href="/api/auth/discord/login">
                Continue With Discord
              </Link>
            )}
            <a
              className="button secondary"
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noreferrer"
            >
              Open Discord Developer Portal
            </a>
          </div>
        </div>

        <aside className="panel hero-side">
          <div className="stat-card">
            <div className="stat-label">What this app does first</div>
            <div className="stat-value">Login + Guild Access</div>
            <p className="muted">
              Users authenticate with Discord, view manageable guilds, and install NOVA without
              needing a public bot webpage on the bot service itself.
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-label">What comes next</div>
            <div className="stat-value">Guild Controls</div>
            <p className="muted">
              After installation, this dashboard can be extended to manage aliases, allowed
              speakers, command toggles, and audit logs backed by Railway Postgres.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
