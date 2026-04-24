#!/bin/bash
# 미래비즈온 라이선스 발급 스크립트
# 사용법: ./create-license.sh BETA-XXXX-XXXX [일수] [메모]

KEY=${1:-"BETA-$(openssl rand -hex 2 | tr '[:lower:]' '[:upper:]')-$(openssl rand -hex 2 | tr '[:lower:]' '[:upper:]')"}
DAYS=${2:-30}
MEMO=${3:-"Beta tester"}

echo "라이선스 발급: $KEY ($DAYS일)"

curl -s -X POST https://mirae-bizon-analyzer.maclub7.workers.dev/api/license \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"admin-create\",
    \"adminKey\": \"MIRAE-ADMIN-2026\",
    \"key\": \"$KEY\",
    \"trialDays\": $DAYS,
    \"maxDevices\": 1,
    \"memo\": \"$MEMO\"
  }" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "테스터에게 전달할 키: $KEY"
