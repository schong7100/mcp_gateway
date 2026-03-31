'use client';

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export function Nav() {
  const { user, isAdmin, isLoading, logout } = useAuth();

  return (
    <nav className="bg-gray-900 text-white px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          MCP Gateway
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
                필터 관리
              </Link>
              <Link href="/users" className="hover:text-gray-300 text-sm">
                사용자 관리
              </Link>
            </>
          )}
          {!isLoading && user && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-700">
              <span className="text-sm text-gray-300">
                {user.username}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded ${
                  isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-200'
                }`}>
                  {isAdmin ? 'admin' : 'viewer'}
                </span>
              </span>
              <button
                onClick={logout}
                className="text-xs text-gray-400 hover:text-white border border-gray-600 rounded px-2 py-1 hover:border-gray-400 transition-colors"
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
