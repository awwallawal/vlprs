export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-md focus:bg-crimson focus:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-300 focus-visible:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}
