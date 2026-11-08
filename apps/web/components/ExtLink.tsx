import type { ReactNode } from "react";

/** Link to an external page. Always opens in a new tab and says so to screen-reader users. */
export function ExtLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr"> (opens in a new tab)</span>
    </a>
  );
}
