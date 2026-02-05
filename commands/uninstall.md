---
description: ClaudeUsage 삭제 전 설정을 정리합니다
---

# ClaudeUsage 삭제 준비

## 지시사항

이 명령어는 플러그인 삭제 전 settings.json에서 statusLine 설정을 제거합니다.

1. `~/.claude/settings.json` 파일을 읽으세요

2. 파일이 존재하고 `statusLine` 설정이 있으면:
   - `statusLine` 항목 전체를 제거
   - 다른 설정은 그대로 유지

3. 파일이 없거나 `statusLine` 설정이 없으면:
   - "statusLine 설정이 없습니다."라고 안내

4. 완료 후 사용자에게 안내:
   ```
   ✓ statusLine 설정이 제거되었습니다.

   이제 다음 명령어로 플러그인을 삭제할 수 있습니다:
   /plugin uninstall claudeusage@claudeusage-marketplace
   ```

## 주의사항

- 기존 settings.json의 다른 설정은 반드시 유지해야 합니다
- JSON 형식이 올바른지 확인하세요
- 이 명령어는 플러그인 파일을 삭제하지 않습니다 (설정만 정리)
