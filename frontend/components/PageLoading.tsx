export default function PageLoading() {
  return (
    <div className="min-h-screen bg-paper font-body">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <header className="flex items-baseline justify-between">
          <span className="font-display font-black text-3xl tracking-tight text-amber uppercase">
            MakeDigest
          </span>
        </header>
        <div className="mt-3 rule" />
        <div className="mt-[3px] rule mb-8" />
        <div className="py-16 flex flex-col items-center">
          <div className="w-40 h-[2px] bg-line relative overflow-hidden mb-6">
            <div className="absolute inset-y-0 w-1/3 bg-amber animate-[scan_1.2s_ease-in-out_infinite]" />
          </div>
          <p className="font-mono text-xs text-muted uppercase tracking-widest">
            Loading
          </p>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
