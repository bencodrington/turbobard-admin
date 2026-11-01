export default function App() {
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">Turbobard</p>
        <h1>Admin</h1>
      </header>
      <section className="welcome-panel" aria-labelledby="welcome-heading">
        <p className="eyebrow">Private catalog workspace</p>
        <h2 id="welcome-heading">Administration foundation ready</h2>
        <p>
          Catalog access is not connected yet. This workspace is read-only until
          the integration and access checks are complete.
        </p>
      </section>
    </main>
  );
}
