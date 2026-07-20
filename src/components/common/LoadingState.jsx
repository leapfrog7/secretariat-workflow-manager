export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="surface flex min-h-36 items-center justify-center rounded-md p-6 text-sm text-slate-600">
      {message}
    </div>
  );
}
