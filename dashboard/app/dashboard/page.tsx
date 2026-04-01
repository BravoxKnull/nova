import { GuildCard } from "../../components/GuildCard";
import { fetchDiscordGuilds } from "../../lib/discord";
import { mapGuildsForDashboard } from "../../lib/guilds";
import { getDashboardSession } from "../../lib/session";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getDashboardSession();
  if (!session) {
    return (
      <main className="shell page">
        <section className="dashboard-head">
          <div>
            <p className="eyebrow">Session required</p>
            <h1 className="page-title">Sign in to continue.</h1>
            <p className="muted">
              Your dashboard session is missing or expired. Sign in again to view and configure
              your servers.
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
  const dashboardGuilds = mapGuildsForDashboard(guilds);

  return (
    <main className="shell page">
      <section className="dashboard-head">
        <div>
          <p className="eyebrow">Authenticated as {session.user.global_name ?? session.user.username}</p>
          <h1 className="page-title">Your Servers</h1>
          <p className="muted">
            Only servers where you are the owner or have Manage Server are shown here. Opening a
            guild config page creates the default NOVA records for that server automatically.
          </p>
        </div>
      </section>

      {dashboardGuilds.length === 0 ? (
        <div className="empty-state">
          No manageable guilds were returned by Discord. Make sure you are logged into the correct
          account and that you have Manage Server in at least one guild.
        </div>
      ) : (
        <section className="grid guild-grid">
          {dashboardGuilds.map((guild) => (
            <GuildCard key={guild.id} guild={guild} />
          ))}
        </section>
      )}
    </main>
  );
}
