import type { ReactNode } from "react";
import { DISCLAIMER } from "@permit/schema";
import { StoreProvider } from "../lib/store";
import { StepNav } from "../components/StepNav";
import { ContrastToggle } from "../components/ContrastToggle";
import "./globals.css";

export const metadata = {
  title: "PermitReady Kitchener",
  description: "Check that your building permit application is complete before you submit it.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Aleo:wght@600;700&family=Lato:wght@400;700&display=swap" rel="stylesheet" />
        {/* apply the saved contrast preference before paint */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('permitready-contrast')==='high')document.documentElement.dataset.contrast='high'}catch(e){}" }} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to main content</a>
        <StoreProvider>
          <header className="top">
            <div className="wrap">
              <a className="brand" href="/">
                <strong>PermitReady Kitchener</strong>
                <span>Building permit application checker</span>
              </a>
              <div className="header-actions">
                <ContrastToggle />
              </div>
            </div>
          </header>
          <StepNav />
          <main id="main" className="wrap">{children}</main>
          <footer className="site">
            <div className="wrap">
              <p><strong>Preliminary guidance only.</strong> {DISCLAIMER}</p>
              <p>
                Official information:{" "}
                <a href="https://www.kitchener.ca/development-and-construction/building-permits/">City of Kitchener building permits</a>
                {" · "}
                <a href="https://www.kitchener.ca/development-and-construction/building-permits/building-applications-and-standard-forms/">Building applications and standard forms</a>
              </p>
            </div>
          </footer>
        </StoreProvider>
      </body>
    </html>
  );
}
