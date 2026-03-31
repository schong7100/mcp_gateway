import Link from "next/link";

export function Nav() {
  return (
    <nav className="bg-gray-900 text-white px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          MCP Gateway
        </Link>
        <div className="flex gap-6">
          <Link href="/logs" className="hover:text-gray-300">
            검색 로그
          </Link>
          <Link href="/filters" className="hover:text-gray-300">
            필터 관리
          </Link>
          <Link href="/audit" className="hover:text-gray-300">
            감사 로그
          </Link>
          <Link href="/users" className="hover:text-gray-300">
            사용자 관리
          </Link>
        </div>
      </div>
    </nav>
  );
}
