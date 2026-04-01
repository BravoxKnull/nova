import Link from "next/link";
import type { DashboardGuildViewModel } from "../lib/guilds";

export function GuildCard({ guild }: { guild: DashboardGuildViewModel }) {
  return (
    <article className="guild-card">
      <h3>{guild.name}</h3>
      <p className="muted">
        Install NOVA into this server, then continue to guild-specific moderation settings.
      </p>

      <div className="guild-meta">
        <span className="pill success">Manageable</span>
        <span className="pill">Guild ID {guild.id}</span>
      </div>

      <div className="row">
        <a className="button" href={guild.installUrl} target="_blank" rel="noreferrer">
          Invite NOVA
        </a>
        <Link className="button secondary" href={`/dashboard/${guild.id}`}>
          Open Config
        </Link>
      </div>
    </article>
  );
}
