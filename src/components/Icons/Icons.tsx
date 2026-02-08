type IconProps = {
  size?: number;
  className?: string;
};

export function ChevronRight({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 4L10 8L6 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronDown({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FolderIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2 4C2 3.44772 2.44772 3 3 3H6.17157C6.43679 3 6.69114 3.10536 6.87868 3.29289L7.70711 4.12132C7.89464 4.30886 8.149 4.41421 8.41421 4.41421H13C13.5523 4.41421 14 4.86193 14 5.41421V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z"
        fill="#FBBF24"
        stroke="#D97706"
        strokeWidth="1"
      />
    </svg>
  );
}

export function FolderOpenIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2 5C2 4.44772 2.44772 4 3 4H5.58579C5.851 4 6.10536 4.10536 6.29289 4.29289L7 5H13C13.5523 5 14 5.44772 14 6V6.5H3.5L2 6.5V5Z"
        fill="#FBBF24"
        stroke="#D97706"
        strokeWidth="1"
      />
      <path d="M2.5 6.5H14L12.5 12.5H1L2.5 6.5Z" fill="#FCD34D" stroke="#D97706" strokeWidth="1" />
    </svg>
  );
}

export function ArchiveIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="3"
        width="12"
        height="10"
        rx="1"
        fill="#DBEAFE"
        stroke="#3B82F6"
        strokeWidth="1"
      />
      <rect x="6" y="5" width="4" height="2" rx="0.5" fill="#3B82F6" />
      <path
        d="M6 8H10V10C10 10.5523 9.55228 11 9 11H7C6.44772 11 6 10.5523 6 10V8Z"
        fill="#60A5FA"
      />
    </svg>
  );
}
