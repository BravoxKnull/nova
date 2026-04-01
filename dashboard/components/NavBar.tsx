import Link from "next/link";

export function NavBar(props: {
  authenticated: boolean;
  userName?: string;
}) {
  return (
    <header className="nav shell">
      <Link href="/" className="nav-brand">
        <span className="nav-mark">N</span>
        <span>NOVA Dashboard</span>
      </Link>

      <div className="row">
        {props.authenticated ? (
          <>
            <span className="pill success">{props.userName ?? "Signed in"}</span>
            <Link className="button secondary" href="/dashboard">
              Dashboard
            </Link>
            <Link className="button secondary" href="/api/auth/discord/logout">
              Log Out
            </Link>
          </>
        ) : (
          <Link className="button secondary" href="/api/auth/discord/login">
            Log In With Discord
          </Link>
        )}
      </div>
    </header>
  );
}
