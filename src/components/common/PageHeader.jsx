export default function PageHeader({ title, description, actions }) {
  return (
    <header className="mb-4 sm:mb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="ui-page-title tracking-tight text-[#17333b]">
            {title}
          </h1>

          {description && (
            <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600 sm:leading-6">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
