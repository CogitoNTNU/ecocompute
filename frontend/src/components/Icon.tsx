const paths = {
  leaf: 'M20 4C10 2 3 6 4 13c1 7 12 8 15-1 1-3 1-5 1-8ZM4 21 15 10M8 17v-5m0 5h5',
  chat: 'M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0ZM7 10h10M7 14h6',
  chart: 'M4 3v17h17M8 15v-4m5 4V7m5 8V4',
  arrow: 'm5 12 7-7 7 7M12 5v14',
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z',
  server: 'M4 3h16v7H4zM4 14h16v7H4zM7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6',
  plus: 'M12 5v14M5 12h14',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  globe: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2c6 6 6 14 0 20-6-6-6-14 0-20Z',
  info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  chevron: 'm9 5 7 7-7 7',
  refresh: 'M20 7a9 9 0 1 0 1 8M20 2v6h-6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  check: 'm5 12 4 4L19 6',
  stop: 'M6 6h12v12H6z',
};
export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
