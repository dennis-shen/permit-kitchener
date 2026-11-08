import type { ReactNode } from "react";
import { DISCLAIMER } from "@permit/schema";
import { StoreProvider } from "../lib/store";
import { StepNav } from "../components/StepNav";
import { ExtLink } from "../components/ExtLink";
import "./globals.css";

export const metadata = {
  title: "Permit Checker",
  description: "Check that your building permit application is complete before you submit it.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <a className="skip" href="#main">Skip to main content</a>
        <StoreProvider>
          <header className="top">
            <div className="wrap">
              <a className="brand" href="/">
                <strong>Permit Checker</strong>
              </a>
            </div>
          </header>
          <StepNav />
          <main id="main" className="wrap">{children}</main>
          <footer className="site">
            <div className="wrap">
              <p><strong>Preliminary guidance only.</strong> {DISCLAIMER}</p>
              <p>
                Official information:{" "}
                <ExtLink href="https://www.kitchener.ca/development-and-construction/building-permits/">City of Kitchener building permits</ExtLink>
                {" · "}
                <ExtLink href="https://www.kitchener.ca/development-and-construction/building-permits/building-applications-and-standard-forms/">Building applications and standard forms</ExtLink>
              </p>
            </div>
          </footer>
        </StoreProvider>
      </body>
    </html>
  );
}
