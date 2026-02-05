# ClaudeUsage

Claude Pro 구독 사용량을 실시간으로 모니터링하는 Claude Code 플러그인입니다.

## 기능

- Claude Code status line에서 사용량 실시간 표시
- 세션(5시간) 및 주간(7일) 사용량 추적
- 자동 토큰 갱신 및 캐싱
- 다국어 지원 (한국어/영어)

## 요구사항

- Node.js 18+
- Claude Pro 구독 (API 접근 필요)

## 설치

### 플러그인 마켓플레이스 (권장)

Claude Code에서 다음 명령어를 실행합니다:

```bash
# 1. 마켓플레이스 등록
/plugin marketplace add SleighMaster99/claudeusage-marketplace

# 2. 플러그인 설치
/plugin install claudeusage@claudeusage-marketplace

# 3. Status Line 초기화 (settings.json 자동 설정)
/claudeusage:init

# 4. Claude Code 재시작
```

### 사용 가능한 기능

| 기능 | 사용 방법 |
|------|----------|
| Status Line | `/claudeusage:init`으로 자동 설정 |
| 슬래시 명령어 | `/claudeusage:usage` |
| 자연어 스킬 | "사용량 확인해줘", "Check my usage" |

### 업데이트

```bash
/plugin update claudeusage@claudeusage-marketplace
```

### 삭제

```bash
/plugin uninstall claudeusage@claudeusage-marketplace
```

## Status Line 설정

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

### 표시 예시

```
📊 세션: ████░░░░ 45% (2h 34m) | 주간: █░░░░░░░ 12%
```

- 세션(5시간): 현재 세션의 사용량
- 주간(7일): 주간 전체 사용량
- 80% 이상 시 경고 표시

## 인증 설정

Claude API 접근을 위해 credentials가 필요합니다.

### credentials.json 위치

```
~/.claude.ai/credentials.json
```

### 형식

```json
{
  "accessToken": "your-access-token",
  "refreshToken": "your-refresh-token",
  "expiresAt": "2026-01-23T12:00:00Z"
}
```

> **참고**: credentials.json은 Claude 웹 앱에서 자동으로 생성됩니다. 직접 추출이 필요한 경우 브라우저 개발자 도구에서 확인할 수 있습니다.

## 설정

### 설정 파일

`~/.claudeusage/config/settings.json`:

```json
{
  "cacheTtlSeconds": 30,
  "language": "ko"
}
```

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `cacheTtlSeconds` | 30 | API 응답 캐시 시간 (초) |
| `language` | "ko" | 언어 ("ko" 또는 "en") |

### 환경 변수

환경 변수가 설정 파일보다 우선합니다:

| 변수 | 설명 |
|------|------|
| `CLUSAGE_LANG` | 언어 설정 ("ko" 또는 "en") |
| `CLUSAGE_CACHE_TTL` | 캐시 TTL (초) |
| `CLUSAGE_TEST_MODE` | "true"로 설정 시 테스트 모드 |

## 테스트 모드

API credentials 없이 테스트하려면:

```bash
CLUSAGE_TEST_MODE=true node dist/statusline.js
```

출력 예:
```
[TEST MODE] 📊 세션: ████░░░░ 45% (4h 59m) | 주간: █░░░░░░░ 12%
```

## 트러블슈팅

### "인증 정보를 찾을 수 없습니다"

- `~/.claude.ai/credentials.json` 파일이 있는지 확인
- 파일 권한 확인 (읽기 권한 필요)

### "토큰이 만료되었습니다"

- Claude 웹 앱에 로그인하여 새 토큰 발급
- 토큰이 자동 갱신되지 않으면 credentials.json 재생성

### 플러그인이 동작하지 않음

1. 플러그인 재설치:
   ```bash
   /plugin uninstall claudeusage@claudeusage-marketplace
   /plugin install claudeusage@claudeusage-marketplace
   ```
2. Claude Code 재시작

### 업데이트 후 이전 버전이 표시됨

플러그인 캐시 문제로 업데이트 후에도 이전 버전이 표시될 수 있습니다. 다음 단계로 해결하세요:

1. 캐시 폴더 삭제:
   ```bash
   # macOS/Linux
   rm -rf ~/.claude/plugins/cache/claudeusage-marketplace

   # Windows (PowerShell)
   Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\plugins\cache\claudeusage-marketplace"
   ```

2. 플러그인 재설치:
   ```bash
   /plugin install claudeusage@claudeusage-marketplace
   ```

3. Claude Code 재시작

## 개발

```bash
# 테스트 실행
npm test

# 감시 모드
npm run test:watch

# 빌드
npm run build
```

## 보안

### 토큰 관리

ClaudeUsage는 Claude API 접근을 위해 OAuth 토큰을 사용합니다. 토큰 보안을 위해 다음 사항을 권장합니다:

#### 파일 권한

credentials.json 파일은 민감한 정보를 포함하므로 적절한 권한 설정이 필요합니다:

```bash
# Unix/macOS (소유자만 읽기/쓰기)
chmod 600 ~/.claude.ai/credentials.json

# 디렉토리 권한
chmod 700 ~/.claude.ai
```

Windows에서는 파일 속성에서 "다른 사용자의 액세스 제한"을 설정하거나:
```powershell
icacls "$env:USERPROFILE\.claude.ai\credentials.json" /inheritance:r /grant:r "$env:USERNAME:(R,W)"
```

#### 토큰 갱신

- accessToken이 만료되면 자동으로 refreshToken을 사용하여 갱신합니다
- 갱신된 토큰은 credentials.json에 저장됩니다
- 갱신 실패 시 토큰이 무효화될 수 있으므로 주기적으로 Claude 웹 앱 로그인을 권장합니다

### 데이터 저장

- 사용량 데이터: `~/.claudeusage/data/daily/` (로컬에만 저장)
- 캐시: `~/.claudeusage/cache/` (30초 TTL)
- 설정: `~/.claudeusage/config/`

모든 데이터는 로컬에만 저장되며 외부로 전송되지 않습니다 (Claude API 호출 제외).

### 권장 사항

1. credentials.json을 버전 관리 시스템에 포함하지 마세요
2. 공유 컴퓨터에서는 사용 후 토큰을 무효화하세요
3. 정기적으로 토큰을 갱신하세요

## 라이선스

MIT

## 관련 링크

- [Claude Code Status Line 문서](https://code.claude.com/docs/ko/statusline)
