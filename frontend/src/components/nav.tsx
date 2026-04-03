'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

const NAV_LINKS = [
  { href: "/logs",    label: "검색 로그" },
  { href: "/audit",   label: "감사 로그" },
  { href: "/filters", label: "필터 규칙",  adminOnly: true },
  { href: "/users",   label: "사용자 관리", adminOnly: true },
  { href: "/settings",label: "설정" },
];

export function Nav() {
  const { user, isAdmin, isLoading, logout } = useAuth();
  const { darkMode, toggleDarkMode, logoUrl, primaryColor } = useTheme();
  const pathname = usePathname();

  const links = NAV_LINKS.filter((l) => !l.adminOnly || isAdmin);

  return (
    <nav
      className="text-white shadow-lg"
      style={{
        background: `linear-gradient(135deg, ${primaryColor} 0%, #0F2A54 100%)`,
      }}
    >
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo + title */}
          <Link href="/" className="flex items-center gap-3 group">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="로고" className="h-8 w-auto" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-md"
                style={{ backgroundColor: '#E8821C' }}
              >
                MG
              </div>
            )}
            <div>
              <div className="text-sm font-bold tracking-wide leading-tight">MCP Gateway</div>
              <div className="text-[10px] text-white/60 leading-tight tracking-wider uppercase">Security Portal</div>
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => {
              const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    active
                      ? "bg-white/20 text-white shadow-inner"
                      : "text-white/75 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-all"
              title={darkMode ? "라이트 모드" : "다크 모드"}
            >
              {darkMode ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            {/* User info */}
            {!isLoading && user && (
              <div className="flex items-center gap-2 pl-3 border-l border-white/20">
                <div className="flex flex-col items-end leading-tight">
                  <span className="text-xs font-semibold text-white/90">{user.username}</span>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm mt-0.5"
                    style={{
                      backgroundColor: isAdmin ? '#E8821C' : 'rgba(255,255,255,0.15)',
                      color: 'white',
                    }}
                  >
                    {isAdmin ? "ADMIN" : "VIEWER"}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white border border-white/20 hover:border-white/40 rounded-md px-2.5 py-1.5 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Orange accent line */}
      <div className="h-0.5" style={{ background: 'linear-gradient(to right, #E8821C, #F5A623, transparent)' }} />
    </nav>
  );
}
