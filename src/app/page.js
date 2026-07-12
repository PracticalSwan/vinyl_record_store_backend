const endpoints = [
  ["Health", "/api/health"],
  ["Products", "/api/products"],
  ["Search", "/api/search?q=jazz"],
  ["Account recommendations", "/api/recommendations/me"],
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
          Storefront integration service
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Groovehaus API</h1>
        <p className="max-w-2xl text-zinc-600">
          This Next.js application serves the record catalog and explainable
          recommendation endpoints consumed by the separate React storefront.
        </p>
      </div>

      <section aria-labelledby="endpoint-heading" className="space-y-3">
        <h2 id="endpoint-heading" className="text-lg font-semibold">
          Available read-only endpoints
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {endpoints.map(([label, href]) => (
            <li key={href}>
              <a
                className="block rounded-lg border border-zinc-200 bg-white p-4 font-medium shadow-sm transition hover:border-amber-700 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                href={href}
              >
                {label}
                <span className="mt-1 block font-mono text-xs font-normal text-zinc-500">
                  {href}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
