export default function SwmMark({ className = '' }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <rect width="64" height="64" rx="14" fill="#17333b" />
      <rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="#31515a" strokeWidth="2" />
      <path d="M18 19h22a6 6 0 0 1 0 12H24a6 6 0 0 0 0 12h22" fill="none" stroke="#f8fafc" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="19" r="4" fill="#5eead4" />
      <circle cx="46" cy="43" r="4" fill="#5eead4" />
    </svg>
  );
}
