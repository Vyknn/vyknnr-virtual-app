import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai"],
});

export const metadata: Metadata = {
  title: "Pixel Forge Studio — AI Agent Orchestrator",
  description: "จำลองออฟฟิศ AI Agent แบบ 3 มิติ ไอโซเมตริก",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${inter.variable} ${notoSansThai.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's cz-shortcut-listen) inject
          attributes on <body> before hydration. Only silences this element's own attributes, not children. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
