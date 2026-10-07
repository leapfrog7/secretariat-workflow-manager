export default function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <header className="mb-5 border-b border-[var(--swm-border)] pb-4 sm:mb-6 sm:pb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          {eyebrow ? <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.16em] text-teal-700">{eyebrow}</p> : null}
          <h1 className="text-lg font-semibold leading-snug tracking-tight text-[var(--swm-ink)] sm:text-2xl sm:leading-tight">
            {title}
          </h1>

          {description ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-5 text-[var(--swm-muted)] sm:leading-6">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
