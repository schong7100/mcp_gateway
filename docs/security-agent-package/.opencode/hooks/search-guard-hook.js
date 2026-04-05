#!/usr/bin/env node
/**
 * MCP Gateway — Search Guard Hook (PreToolUse)
 *
 * context7/exa MCP 도구 호출 전 민감정보를 탐지하고 차단/치환합니다.
 * oh-my-openagent의 PreToolUse 훅으로 동작합니다.
 *
 * 동작:
 *   1. stdin으로 PreToolUseInput JSON 수신
 *   2. tool_input의 모든 문자열 값에서 민감정보 패턴 스캔
 *   3. 발견 시 → 일반화 치환 후 updatedInput으로 반환 (allow)
 *   4. PII(주민번호 등) 발견 시 → deny 반환
 *   5. 미발견 시 → allow 반환
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), '.opencode', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'search-guard.log');

// ── 민감정보 패턴 (차단/치환) ──────────────────────────────────────

const DENY_PATTERNS = [
  { name: '주민등록번호', pattern: /\d{6}-[1-4]\d{6}/g },
  { name: '신용카드번호', pattern: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g },
  { name: '계좌번호', pattern: /\d{3}-\d{2,6}-\d{6,12}/g },
];

const REPLACE_PATTERNS = [
  { name: '사설IP(10.x)', pattern: /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[내부서버]' },
  { name: '사설IP(172.16-31)', pattern: /\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/g, replacement: '[내부서버]' },
  { name: '사설IP(192.168)', pattern: /\b192\.168\.\d{1,3}\.\d{1,3}\b/g, replacement: '[내부서버]' },
  { name: '이메일', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[이메일]' },
  { name: '휴대폰번호', pattern: /\b01[016789]-?\d{3,4}-?\d{4}\b/g, replacement: '[전화번호]' },
  { name: 'DB접속문자열', pattern: /(postgres|mysql|mongodb|redis):\/\/[^\s]+/gi, replacement: '[DB접속정보]' },
  { name: 'AWS키', pattern: /AKIA[A-Z0-9]{16}/g, replacement: '[AWS키]' },
  { name: 'Bearer토큰', pattern: /Bearer\s+[a-zA-Z0-9._\-]{20,}/gi, replacement: '[인증토큰]' },
  { name: 'API키패턴', pattern: /(?:api[_-]?key|secret|token|password)\s*[=:]\s*['"]?[a-zA-Z0-9._\-]{8,}['"]?/gi, replacement: '[인증정보]' },
];

// ── 유틸리티 ───────────────────────────────────────────────────────

function log(message) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `${timestamp} ${message}\n`);
  } catch { /* 로깅 실패 무시 */ }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

function scanText(text) {
  const denied = [];
  const replaced = [];

  for (const rule of DENY_PATTERNS) {
    if (rule.pattern.test(text)) {
      denied.push(rule.name);
    }
    rule.pattern.lastIndex = 0;
  }

  let sanitized = text;
  for (const rule of REPLACE_PATTERNS) {
    const matches = sanitized.match(rule.pattern);
    if (matches) {
      replaced.push({ name: rule.name, count: matches.length });
      sanitized = sanitized.replace(rule.pattern, rule.replacement);
    }
    rule.pattern.lastIndex = 0;
  }

  return { denied, replaced, sanitized, modified: sanitized !== text };
}

function scanInput(toolInput) {
  const allDenied = [];
  const allReplaced = [];
  const updatedInput = JSON.parse(JSON.stringify(toolInput));
  let modified = false;

  function walk(obj, path) {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const result = scanText(value);
        if (result.denied.length > 0) allDenied.push(...result.denied);
        if (result.replaced.length > 0) allReplaced.push(...result.replaced);
        if (result.modified) {
          modified = true;
          // updatedInput의 해당 경로에 치환된 값 설정
          let target = updatedInput;
          const parts = path.concat(key);
          for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
          target[parts[parts.length - 1]] = result.sanitized;
        }
      } else if (typeof value === 'object') {
        walk(value, path.concat(key));
      }
    }
  }

  walk(toolInput, []);
  return { denied: allDenied, replaced: allReplaced, updatedInput, modified };
}

// ── 메인 ───────────────────────────────────────────────────────────

async function main() {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
    return;
  }

  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};

  // context7/exa MCP 도구만 검사
  if (!toolName.includes('context7') && !toolName.includes('exa')) {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
    return;
  }

  log(`[SCAN] ${toolName} — input: ${JSON.stringify(toolInput).substring(0, 200)}`);

  const result = scanInput(toolInput);

  // PII 발견 → 차단
  if (result.denied.length > 0) {
    const reason = `민감정보 차단: ${result.denied.join(', ')}`;
    log(`[DENY] ${toolName} — ${reason}`);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }));
    return;
  }

  // 치환 발생 → 수정된 입력으로 허용
  if (result.modified) {
    const replacedNames = result.replaced.map((r) => r.name).join(', ');
    log(`[SANITIZE] ${toolName} — 치환: ${replacedNames}`);
    process.stdout.write(JSON.stringify({
      systemMessage: `🔒 검색어에서 민감정보를 일반화했습니다: ${replacedNames}`,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: result.updatedInput,
      },
    }));
    return;
  }

  // 클린 → 허용
  log(`[ALLOW] ${toolName}`);
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
});
