import type { ReactNode } from "react";
import { DISCLAIMER } from "@permit/schema";

export const metadata = { title: "PermitReady Kitchener", description: "Prepare a complete building permit application." };

// OWNER: Kiro-1 — placeholder shell from Phase 0.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header><strong>PermitReady Kitchener</strong> · Prototype · synthetic data</header>
        <main>{children}</main>
        <footer><p>{DISCLAIMER}</p></footer>
      </body>
    </html>
  );
}
