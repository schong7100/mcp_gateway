export default function UsersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + 사용자 추가
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">사용자명</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">이메일</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">역할</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">상태</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">작업</th>
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

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800">역할 안내</h3>
        <ul className="mt-2 text-sm text-blue-700 space-y-1">
          <li>• <strong>admin</strong>: 필터 관리 + 사용자 관리 + 모든 로그 조회</li>
          <li>• <strong>viewer</strong>: 로그 조회만 (읽기 전용)</li>
        </ul>
      </div>
    </div>
  );
}
