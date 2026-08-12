export default function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-3 flex flex-col gap-2.5 border-b border-[#d7e3e1] pb-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-5">
      <div className="min-w-0">
        <div className="mb-1 h-1 w-7 rounded-full bg-teal-600 sm:mb-2 sm:w-9" aria-hidden="true" />
        <h1 className="ui-page-title break-words tracking-normal text-[#17333b] sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[13px] leading-[1.45] text-slate-600 sm:mt-1.5 sm:text-sm sm:leading-6">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 [&>*]:flex-1 sm:w-auto sm:[&>*]:flex-none">{actions}</div>}
    </div>
  );
}
