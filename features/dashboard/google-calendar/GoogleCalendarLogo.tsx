export function GoogleCalendarLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2.5" y="3.5" width="19" height="18" rx="3" fill="#fff" stroke="#dadce0" />
      <path d="M2.5 6.5a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3V9h-19z" fill="#4285F4" />
      <text
        x="12"
        y="18.6"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill="#1a73e8"
        fontFamily="Arial, sans-serif"
      >
        31
      </text>
    </svg>
  );
}
