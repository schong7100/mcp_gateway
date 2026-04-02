#!/bin/bash
# 폐쇄망용 자체 서명 인증서 생성
# Usage: ./generate-certs.sh [IP_ADDRESS]

set -euo pipefail

IP="${1:-10.1.10.188}"
DAYS=3650
OUT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== MCP Gateway 자체 서명 인증서 생성 ==="
echo "IP: ${IP}"
echo "유효기간: ${DAYS}일"
echo "출력: ${OUT_DIR}"

openssl req -x509 -nodes -newkey rsa:2048 \
  -days "${DAYS}" \
  -keyout "${OUT_DIR}/server.key" \
  -out "${OUT_DIR}/server.crt" \
  -subj "/CN=MCP Gateway/O=MCP Gateway/C=KR" \
  -addext "subjectAltName=IP:${IP},IP:127.0.0.1,DNS:localhost"

chmod 644 "${OUT_DIR}/server.crt"
chmod 600 "${OUT_DIR}/server.key"

echo "=== 완료 ==="
echo "  인증서: ${OUT_DIR}/server.crt"
echo "  개인키: ${OUT_DIR}/server.key"
echo ""
echo "브라우저에서 자체 서명 인증서 경고가 뜨면 '계속 진행'을 선택하세요."
