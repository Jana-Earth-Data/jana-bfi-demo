import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jana BFI Demo - Financed Emissions",
  description: "Scope 3 financed emissions dashboard for Nepal BFIs, powered by Jana Earth Data",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
