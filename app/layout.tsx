import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is the MNAWeb brand typeface — self-hosted via next/font, exposed as a CSS
// variable and wired to --font-sans in globals.css so every page inherits it.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MNA Technologies — Employee Onboarding",
  description:
    "Securely provide your new starter's details so MNA Technologies can have everything ready before day one.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
