import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main>
      <h1>Privacy</h1>
      <p>
        We only store your Kick username and auth token data required to keep you
        logged in.
      </p>
      <div className="card" style={{ marginTop: 16 }}>
        <p>Stored account fields:</p>
        <ul>
          <li>Kick username</li>
          <li>Encrypted OAuth token fields for session continuity</li>
          <li>Session metadata required to keep the login active for about 30 days</li>
        </ul>
        <p>
          Draft edit URLs include a private key. Keep the full URL private to avoid
          unauthorized edits.
        </p>
      </div>
      <p style={{ marginTop: 16 }}>
        <Link href="/">Back to home</Link>
      </p>
    </main>
  );
}
