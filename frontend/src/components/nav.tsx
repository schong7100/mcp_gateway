'use client';

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export function Nav() {
  const { user, isAdmin, isLoading, logout } = useAuth();
  const { darkMode, toggleDarkMode, logoUrl, primaryColor } = useTheme();

  return (
    <nav className="text-white px-6 py-4" style={{ backgroundColor: primaryColor }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="로고" className="h-8 w-auto" />
          )}
          <span>MCP Gateway</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/logs" className="hover:text-gray-300 text-sm">
            검색 로그
          </Link>
          <Link href="/audit" className="hover:text-gray-300 text-sm">
            감사 로그
          </Link>
          {isAdmin && (
            <>
              <Link href="/filters" className="hover:text-gray-300 text-sm">
                필터 규칙
              </Link>
              <Link href="/users" className="hover:text-gray-300 text-sm">
                사용자 관리
              </Link>
            </>
          )}
          <Link href="/settings" className="hover:text-gray-300 text-sm">
            설정
          </Link>

          {/* 다크모드 토글 */}
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title={darkMode ? '라이트 모드' : '다크 모드'}
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

          {!isLoading && user && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-white/30">
              <span className="text-sm text-gray-200">
                {user.username}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded ${
                  isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-200'
                }`}>
                  {isAdmin ? 'admin' : 'viewer'}
                </span>
              </span>
              <button
                onClick={logout}
                className="text-xs text-gray-300 hover:text-white border border-white/30 rounded px-2 py-1 hover:border-white/60 transition-colors"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
