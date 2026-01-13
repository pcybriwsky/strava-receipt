import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strava Receipt - Turn Your Workouts Into Receipts",
  description: "Generate beautiful receipt-style summaries of your Strava activities. Download or print your workout receipts.",
  openGraph: {
    title: "Strava Receipt",
    description: "Turn your workouts into beautiful receipts",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
