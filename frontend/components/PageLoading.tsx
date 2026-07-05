export default function PageLoading() {
  return (
    <div className="min-h-screen bg-vellum font-body">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <header className="flex items-baseline justify-between">
          <span className="font-display font-black text-3xl tracking-tight text-ink">
            PULSE
          </span>
        </header>
        <div className="mt-3 border-t border-pencil" />
        <div className="mt-[3px] border-t border-pencil mb-8" />
        <div className="py-16 flex flex-col items-center">
          <div className="w-4 h-4 border-2 border-ink animate-spin mb-6" />
          <p className="font-mono text-[11px] text-pencil uppercase tracking-widest">
            Loading
          </p>
        </div>
      </div>
    </div>
  );
}
