'use client';

import { useState, useRef } from 'react';
import { useTheme } from '@/lib/theme';

const PRESET_COLORS = [
  { name: 'imbank Navy', value: '#1B3F7A' },
  { name: 'Deep Navy', value: '#0F2A54' },
  { name: 'Royal Blue', value: '#2563eb' },
  { name: 'Teal', value: '#0D7377' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Slate', value: '#475569' },
];

export default function SettingsPage() {
  const { darkMode, toggleDarkMode, primaryColor, setPrimaryColor, logoUrl, setLogoUrl } = useTheme();
  const [customColor, setCustomColor] = useState(primaryColor);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setLogoUrl(result);
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setLogoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 dark:text-white">설정</h1>

      <div className="space-y-6">
        {/* 다크모드 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">다크 모드</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                darkMode ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {darkMode ? '다크 모드 ON' : '다크 모드 OFF'}
            </span>
          </div>
        </div>

        {/* 로고 설정 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">회사 로고</h2>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 border-2 border-dashed dark:border-gray-600 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-700">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="로고" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-gray-400 text-xs text-center">로고 없음</span>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100"
              />
              {logoUrl && (
                <button
                  onClick={handleRemoveLogo}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  로고 제거
                </button>
              )}
              <p className="text-xs text-gray-400">PNG, JPG, SVG. 브라우저 로컬에 저장됩니다.</p>
            </div>
          </div>
        </div>

        {/* 테마 컬러 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">테마 컬러</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => { setPrimaryColor(c.value); setCustomColor(c.value); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${
                  primaryColor === c.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: c.value }} />
                <span className="text-xs text-gray-600 dark:text-gray-300">{c.name}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-300">커스텀:</label>
            <input
              type="color"
              value={customColor}
              onChange={(e) => { setCustomColor(e.target.value); setPrimaryColor(e.target.value); }}
              className="w-8 h-8 rounded cursor-pointer"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{primaryColor}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
