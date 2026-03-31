export default function LogsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">검색 로그</h1>
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center gap-4">
          <select className="border rounded px-3 py-1.5 text-sm">
            <option value="">전체 서비스</option>
            <option value="context7">Context7</option>
            <option value="exa">Exa</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded" />
            필터링된 항목만
          </label>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">시간</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">사용자</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">서비스</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">경로</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">상태</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">필터</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-6 py-4 text-gray-400" colSpan={6}>
                Keycloak 인증 연동 후 데이터가 표시됩니다.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
