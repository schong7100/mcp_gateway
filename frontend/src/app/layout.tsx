import type { Metadata } from "next";
import { KeycloakProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP Gateway — 보안 모니터링 포털",
  description: "AI 검색 프록시 모니터링 및 콘텐츠 필터 관리",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen transition-colors">
        <ThemeProvider>
          <KeycloakProvider>
            <Nav />
            <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
          </KeycloakProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
