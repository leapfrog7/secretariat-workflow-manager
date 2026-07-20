export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="surface rounded-md border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <h2 className="font-semibold">{title}</h2>
      {message && <p className="mt-1">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-red-100"
        >
          Retry
        </button>
      )}
    </div>
  );
}
