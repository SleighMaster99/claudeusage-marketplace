---
description: ClaudeUsage 설정을 확인하고 변경합니다 (언어, 통화, 환율 등)
---

# Config 설정

## 지시사항

1. 다음 Bash 명령어를 실행하여 설정을 관리하세요:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/dist/config-cmd.js [options]
   ```

2. 명령어 결과를 사용자에게 표시하세요

## 옵션

| 옵션 | 설명 |
|------|------|
| (없음) | 현재 설정 표시 |
| `--set key=value` | 설정 값 변경 |
| `--reset` | 모든 설정을 기본값으로 초기화 |
| `get key` | 특정 설정 값 조회 |

## 설정 가능한 항목

| 키 | 타입 | 기본값 | 설명 |
|----|------|--------|------|
| `language` | ko \| en | ko | 표시 언어 |
| `cacheTtlSeconds` | number | 30 | 캐시 유효 시간 (초) |
| `currency` | USD \| KRW | USD | 비용 표시 통화 |
| `exchangeRate` | number | 1300 | USD→KRW 환율 |
| `graphStyle` | bar \| line | bar | 히스토리 그래프 스타일 |

## 사용 예시

```bash
# 현재 설정 표시
node ${CLAUDE_PLUGIN_ROOT}/dist/config-cmd.js

# 언어를 영어로 변경
node ${CLAUDE_PLUGIN_ROOT}/dist/config-cmd.js --set language=en

# 그래프 스타일을 라인으로 변경
node ${CLAUDE_PLUGIN_ROOT}/dist/config-cmd.js --set graphStyle=line

# 환율 변경
node ${CLAUDE_PLUGIN_ROOT}/dist/config-cmd.js --set exchangeRate=1400

# 설정 초기화
node ${CLAUDE_PLUGIN_ROOT}/dist/config-cmd.js --reset
```

## 설정 파일 위치

`~/.claudeusage/config/settings.json`

## 참고

- 환경 변수가 설정 파일보다 우선합니다
- `CLUSAGE_LANG`: language 설정
- `CLUSAGE_CACHE_TTL`: cacheTtlSeconds 설정
