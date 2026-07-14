import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"] });

export const metadata: Metadata = {
  title: "קליטת חשבוניות — ויקוס הנדסה",
  description: "העלאת חשבונית ספק, חילוץ אוטומטי והכנסה לטבלת בסיס הנתונים",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={heebo.className + " min-h-screen antialiased"}>
        {children}
      </body>
    </html>
  );
}
