export default function AuditPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">감사 로그</h1>
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center gap-4">
          <select className="border rounded px-3 py-1.5 text-sm">
            <option value="">전체 액션</option>
            <option value="search">검색</option>
            <option value="search_blocked">검색 차단</option>
            <option value="filter_create">필터 생성</option>
            <option value="filter_update">필터 수정</option>
            <option value="filter_delete">필터 삭제</option>
          </select>
          <input
            type="text"
            placeholder="사용자 ID"
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">시간</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">사용자</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">액션</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">리소스</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">상세</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-6 py-4 text-gray-400" colSpan={5}>
                Keycloak 인증 연동 후 데이터가 표시됩니다.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
