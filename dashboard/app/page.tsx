import Link from "next/link";
import { getDashboardSession } from "../lib/session";

export default async function LandingPage() {
  const session = await getDashboardSession();

  return (
    <main className="shell page">
      <section className="hero">
        <div className="panel hero-main">
          <span className="eyebrow">Discord login and server install</span>
          <h1>NOVA Dashboard</h1>
          <p>
            Sign in with Discord, see the servers you can manage, and install NOVA into a guild
            before configuring voice moderation rules.
          </p>

          <div className="hero-actions" style={{ marginTop: "1.5rem" }}>
            {session ? (
              <Link className="button" href="/dashboard">
                Open Dashboard
              </Link>
            ) : (
              <a className="button" href="/api/auth/discord/login">
                Continue With Discord
              </a>
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
            <div className="stat-label">Flow</div>
            <div className="stat-value">Login, choose guild, invite bot</div>
            <p className="muted">
              The dashboard is the public entry point. The bot service stays private on Railway.
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-label">Next</div>
            <div className="stat-value">Guild settings and moderation controls</div>
            <p className="muted">
              This layout is ready to expand into aliases, allowed speakers, command toggles,
              and audit logs.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
