export default function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-[#d7e3e1] pb-4 sm:mb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-5">
      <div className="min-w-0">
        <div className="mb-1.5 h-1 w-8 rounded-full bg-teal-600 sm:mb-2 sm:w-9" aria-hidden="true" />
        <h1 className="break-words text-lg font-semibold tracking-normal text-[#17333b] sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600 sm:mt-1.5 sm:leading-6">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 [&>*]:flex-1 sm:w-auto sm:[&>*]:flex-none">{actions}</div>}
    </div>
  );
}
