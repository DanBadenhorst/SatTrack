export default function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
      <div className="mb-8">
        <div className="h-7 w-48 rounded bg-slate-800" />
        <div className="mt-2 h-4 w-64 rounded bg-slate-800/70" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-slate-900/60 border border-slate-800"
          />
        ))}
      </div>
    </div>
  );
}
