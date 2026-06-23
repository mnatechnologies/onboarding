import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Shared MNA Technologies brand chrome for the onboarding subdomain
 * (onboard.mnatechnologies.com.au). Mirrors the MNAWeb marketing site's header/footer
 * treatment so the token-gated form reads as a first-party page.
 */

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a
            href="https://mnatechnologies.com.au"
            className="flex items-center"
            aria-label="MNA Technologies"
          >
            <Image
              src="/branding/logo.png"
              alt="MNA Technologies"
              width={140}
              height={50}
              priority
              className="h-9 w-auto"
            />
          </a>
          <span className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00b4d8]" />
            Employee Onboarding
          </span>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <p>&copy; {year} MNA Technologies. All rights reserved.</p>
          <p className="flex items-center gap-4">
            <a
              href="mailto:info@mnatechnologies.com.au"
              className="hover:text-[#0066cc] transition-colors"
            >
              info@mnatechnologies.com.au
            </a>
            <a
              href="tel:1300646397"
              className="hover:text-[#0066cc] transition-colors"
            >
              1300 646 397
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Full-page shell: branded header, a light brand-grey work surface that vertically
 * centres its content, and the footer. Used by every onboarding state.
 */
export function FormShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa]">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
