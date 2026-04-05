#!/usr/bin/env node
/**
 * MCP Gateway — Search Log Hook (PostToolUse)
 *
 * context7/exa MCP 도구 호출 결과를 로컬에 로깅합니다.
 * oh-my-openagent의 PostToolUse 훅으로 동작합니다.
 *
 * 로그 위치: .opencode/logs/search-audit.jsonl
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), '.opencode', 'logs');
const AUDIT_FILE = path.join(LOG_DIR, 'search-audit.jsonl');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.stdout.write(raw || '{}');
    return;
  }

  const toolName = input.tool_name || '';

  // context7/exa MCP 도구만 로깅
  if (!toolName.includes('context7') && !toolName.includes('exa')) {
    process.stdout.write(raw);
    return;
  }

  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

    const logEntry = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      input: input.tool_input || {},
      success: !input.tool_response?.error,
      response_preview: String(input.tool_response?.output || '').substring(0, 300),
    };

    fs.appendFileSync(AUDIT_FILE, JSON.stringify(logEntry) + '\n');
  } catch { /* 로깅 실패 무시 */ }

  // PostToolUse는 항상 원본 전달
  process.stdout.write(raw);
}

main().catch(() => {
  process.stdout.write('{}');
});
