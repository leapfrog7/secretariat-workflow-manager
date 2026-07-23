export default function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-4 border-b border-[#d7e3e1] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 h-1 w-9 rounded-full bg-teal-600" aria-hidden="true" />
        <h1 className="break-words text-2xl font-semibold tracking-normal text-[#17333b]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 [&>*]:flex-1 sm:w-auto sm:[&>*]:flex-none">{actions}</div>}
    </div>
  );
}
