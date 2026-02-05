---
description: Claude 구독 사용량 히스토리를 조회합니다 (테이블 + 그래프 + 요약)
---

# History 조회

## 지시사항

1. 다음 Bash 명령어를 실행하여 사용량 히스토리를 조회하세요:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/dist/history.js [options]
   ```

2. 명령어 결과를 사용자에게 표시하세요

## 옵션

| 옵션 | 설명 |
|------|------|
| `today` 또는 `--today` | 오늘 사용량 (시간별) |
| `week` 또는 `--week` | 최근 7일 사용량 (일별) - 기본값 |
| `month` 또는 `--month` | 최근 30일 사용량 (일별) |
| `--cost` | 예상 API 비용 표시 |
| `--compare` | 이번 주 vs 지난 주 비교 (기본값) |
| `--compare week` | 이번 주 vs 지난 주 비교 |
| `--compare month` | 이번 달 vs 지난 달 비교 |
| `--interactive` 또는 `-i` | 인터랙티브 뷰어 모드 실행 |

## 사용 예시

```bash
# 기본 (최근 7일)
node ${CLAUDE_PLUGIN_ROOT}/dist/history.js

# 오늘 시간별 사용량
node ${CLAUDE_PLUGIN_ROOT}/dist/history.js today

# 최근 30일 + 비용 정보
node ${CLAUDE_PLUGIN_ROOT}/dist/history.js --month --cost

# 이번 주 vs 지난 주 비교
node ${CLAUDE_PLUGIN_ROOT}/dist/history.js --compare

# 이번 달 vs 지난 달 비교
node ${CLAUDE_PLUGIN_ROOT}/dist/history.js --compare month

# 인터랙티브 모드
node ${CLAUDE_PLUGIN_ROOT}/dist/history.js --interactive
node ${CLAUDE_PLUGIN_ROOT}/dist/history.js -i
```

## 인터랙티브 모드

`--interactive` (또는 `-i`) 옵션을 사용하면 화살표 키로 날짜를 탐색하고 상세 정보를 확인할 수 있는 인터랙티브 뷰어가 실행됩니다.

### 키 바인딩

| 키 | 기능 |
|----|------|
| ←→↑↓ | 날짜/항목 이동 |
| Enter | 선택한 날짜의 상세 보기 |
| Tab | 캘린더 ↔ 히스토그램 뷰 전환 |
| c | 비교 뷰 (캘린더) / 비교 모드 토글 (히스토그램) |
| [ ] | 이전/다음 월 이동 |
| 1-4 | 히스토그램 뷰 전용: 모드 전환 (일반: 1-3 시간/주/월, 비교: 1-4 시간/요일/주/월) |
| q/ESC | 이전 화면 또는 종료 |

### 뷰 네비게이션

```
┌─────────────┐
│ Calendar    │ ← 메인 뷰 (앱 시작점)
│ View        │
└──────┬──────┘
       │
       ├── Enter ──→ Detail View ──→ ESC/q ──→ Calendar
       │
       ├── c ──────→ Compare View ─→ ESC/q ──→ Calendar
       │
       └── Tab ────→ Histogram View
                     │
                     ├── Tab ─────→ Calendar
                     │
                     ├── c ───────→ Compare Mode (토글)
                     │
                     └── ESC/q ───→ 종료
```

## 출력 내용

### 기본 히스토리 모드
- **일별 요약 테이블**: 날짜별 세션/주간 사용률, 토큰 수
- **사용량 추이 그래프**: 막대 그래프로 시각화
- **요약**: 총 기록 수, 평균/최대 사용률, 총 토큰
- **예상 API 비용** (--cost 옵션): 입력/출력/총 비용

### 비교 모드 (--compare)
- **비교 테이블**: 지표별 이전/현재 기간 값과 증감률
- **증감 표시**: ↑ (증가), ↓ (감소), → (변화 없음)

## 에러 발생 시

"데이터가 없습니다" 메시지가 나오면:
- 히스토리는 `/claudeusage:usage` 명령어 실행 시 자동으로 기록됩니다
- 먼저 usage 명령어를 몇 번 실행한 후 다시 시도하세요
