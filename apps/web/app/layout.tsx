import type { ReactNode } from "react";
import { DISCLAIMER } from "@permit/schema";
import { StoreProvider } from "../lib/store";
import { Nav } from "../components/Nav";
import "./globals.css";

export const metadata = {
  title: "PermitReady Kitchener",
  description: "Prepare a complete building permit application the first time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <header className="top">
            <div className="wrap">
              <a className="logo" href="/">PermitReady Kitchener</a>
              <span className="badge">Prototype · synthetic data</span>
              <Nav />
            </div>
          </header>
          <main className="wrap">{children}</main>
          <footer className="disc">
            <div className="wrap">
              <p><strong>Preliminary guidance only.</strong> {DISCLAIMER}</p>
              <p>
                Official information: <a href="https://www.kitchener.ca/development-and-construction/building-permits/">City of Kitchener building permits</a>.
                Built for CommuniHacks with fictional data. Not a City of Kitchener service.
              </p>
            </div>
          </footer>
        </StoreProvider>
      </body>
    </html>
  );
}
