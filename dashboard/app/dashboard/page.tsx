import { GuildCard } from "../../components/GuildCard";
import { fetchDiscordGuilds } from "../../lib/discord";
import { mapGuildsForDashboard } from "../../lib/guilds";
import { requireDashboardSession } from "../../lib/session";

export default async function DashboardPage() {
  const session = await requireDashboardSession();
  const guilds = await fetchDiscordGuilds(session.accessToken);
  const dashboardGuilds = mapGuildsForDashboard(guilds, (guildId) => `install:${guildId}`);

  return (
    <main className="shell page">
      <section className="dashboard-head">
        <div>
          <p className="eyebrow">Authenticated as {session.user.global_name ?? session.user.username}</p>
          <h1 className="page-title">Your Servers</h1>
          <p className="muted">
            Only servers where you are the owner or have Manage Server are shown here.
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
