import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduLedger",
  description: "School management platform — Ghana & Nigeria",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
