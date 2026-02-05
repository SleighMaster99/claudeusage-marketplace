---
name: usage-monitor
description: Claude 구독 사용량 모니터링 및 관리
---

# Usage Monitor Skill

Claude Pro 구독의 사용량을 모니터링하고 관리하는 스킬입니다.

## 기능

### 사용량 조회

현재 세션(5시간) 및 주간(7일) 사용량을 조회합니다.

- Claude Code 화면 하단 status line에서 실시간 확인
- 프로그레스 바 형식으로 시각화
- 80% 이상 시 경고 표시

### 사용량 분석

- 남은 시간 계산
- 리셋 시간 안내
- 사용 패턴 인사이트

## 트리거 예시

이 스킬은 다음과 같은 요청에서 자동으로 활성화됩니다:

- "사용량 확인해줘"
- "얼마나 사용했어?"
- "남은 할당량 확인"
- "How much quota do I have left?"
- "Check my usage"
- "What's my rate limit?"

## Status Line

Claude Code 화면 하단에서 실시간 사용량을 확인할 수 있습니다:

```
📊 세션: ████░░░░ 45% (2h 34m) | 주간: █░░░░░░░ 12%
```

### Status Line 설정 방법

Status Line을 활성화하려면 `~/.claude/settings.json`에 다음 설정을 추가하세요:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/statusline.js",
    "padding": 0
  }
}
```

설정 후 Claude Code를 재시작하면 화면 하단에 사용량이 표시됩니다.

## 표시 정보

- **세션 사용량**: 5시간 주기로 초기화
- **주간 사용량**: 7일 주기로 초기화
- **프로그레스 바**: 시각적 사용량 표시
- **경고**: 80% 이상 시 ⚠️ 표시

## 다국어 지원

- 한국어 (기본)
- 영어

환경 변수 `CLUSAGE_LANG=en`으로 영어 전환 가능
