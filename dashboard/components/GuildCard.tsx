import Link from "next/link";
import type { DashboardGuildViewModel } from "../lib/guilds";

export function GuildCard({ guild }: { guild: DashboardGuildViewModel }) {
  return (
    <article className="guild-card">
      <h3>{guild.name}</h3>
      <p className="muted">
        {guild.botInstalled
          ? "NOVA is already in this server. You can open configuration now."
          : "Invite NOVA into this server before opening the configuration page."}
      </p>

      <div className="guild-meta">
        <span className="pill success">Manageable</span>
        <span className={guild.botInstalled ? "pill success" : "pill warn"}>
          {guild.botInstalled ? "Bot Installed" : "Invite Required"}
        </span>
        <span className="pill">Guild ID {guild.id}</span>
      </div>

      <div className="row">
        <a
          className={guild.botInstalled ? "button secondary" : "button"}
          href={guild.installUrl}
          target="_blank"
          rel="noreferrer"
        >
          {guild.botInstalled ? "Reinstall NOVA" : "Invite NOVA"}
        </a>
        <Link className="button" href={`/dashboard/${guild.id}`}>
          Open Config
        </Link>
      </div>
    </article>
  );
}
