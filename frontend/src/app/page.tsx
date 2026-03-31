export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">오늘 검색 요청</h2>
          <p className="text-3xl font-bold mt-2">—</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">필터링 건수</h2>
          <p className="text-3xl font-bold mt-2 text-red-600">—</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">활성 필터 규칙</h2>
          <p className="text-3xl font-bold mt-2">—</p>
        </div>
      </div>
    </div>
  );
}
