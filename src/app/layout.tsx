import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Shop Manager",
  description: "Inventory, sales, CRM, and tax estimates for your card business.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
