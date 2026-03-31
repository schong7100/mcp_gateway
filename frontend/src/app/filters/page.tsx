export default function FiltersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">필터 규칙 관리</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + 새 규칙
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">이름</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">유형</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">패턴</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">서비스</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">상태</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">작업</th>
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

      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-medium text-amber-800">기본 필터 예시</h3>
        <ul className="mt-2 text-sm text-amber-700 space-y-1">
          <li>• <strong>주민등록번호</strong>: regex — <code>{`\\d{6}-[1-4]\\d{6}`}</code></li>
          <li>• <strong>IP 주소</strong>: regex — <code>{`\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}`}</code></li>
          <li>• <strong>민감 키워드</strong>: keyword — <code>password,secret,credential,private_key</code></li>
        </ul>
      </div>
    </div>
  );
}
