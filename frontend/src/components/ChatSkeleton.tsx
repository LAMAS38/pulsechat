export function ChatSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-6 sm:px-6"
      aria-busy="true"
      aria-label="Chargement des messages"
    >
      {[false, true, false, true].map((alignRight, i) => (
        <div
          key={i}
          className={`flex gap-2.5 ${alignRight ? "flex-row-reverse" : "flex-row"}`}
        >
          {!alignRight && <div className="skeleton h-9 w-9 shrink-0 rounded-full" />}
          <div className={`space-y-2 ${alignRight ? "items-end" : "items-start"} flex flex-col`}>
            <div className={`skeleton h-10 rounded-2xl ${alignRight ? "w-40" : "w-52"}`} />
            <div className="skeleton h-3 w-12 rounded" />
          </div>
        </div>
      ))}
      <p className="sr-only">Chargement des messages…</p>
    </div>
  );
}
