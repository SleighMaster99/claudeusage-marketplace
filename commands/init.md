---
description: ClaudeUsage Status Line 설정을 초기화합니다
---

# ClaudeUsage 초기화

## 지시사항

1. 먼저 캐시 폴더에서 설치된 플러그인 경로를 찾으세요:
   - `~/.claude/plugins/cache/claudeusage-marketplace/claudeusage/` 폴더 내의 하위 폴더 목록을 확인
   - 폴더가 하나만 있으면 해당 폴더를 사용
   - 폴더가 여러 개면 각 폴더 내 package.json의 version 필드를 읽어서 가장 높은 버전의 폴더 선택
   - **중요**: 폴더 이름은 무시하고 package.json의 version을 확인하세요 (폴더 이름이 잘못될 수 있음)

2. `~/.claude/settings.json` 파일을 읽으세요

3. 파일이 존재하면:
   - 기존 설정에 `statusLine` 항목이 없으면 추가
   - 이미 `statusLine` 설정이 있으면 사용자에게 덮어쓸지 확인

4. 파일이 존재하지 않으면:
   - 새로 생성

5. 추가할 설정 (1단계에서 찾은 폴더 경로 사용):
   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "node {폴더경로}/dist/statusline.js",
       "padding": 0
     }
   }
   ```

6. 설정 완료 후 사용자에게 안내:
   - "설정이 완료되었습니다. Claude Code를 재시작하면 화면 하단에 사용량이 표시됩니다."

## 주의사항

- 기존 settings.json의 다른 설정은 유지해야 합니다
- JSON 형식이 올바른지 확인하세요
- 캐시 폴더에서 플러그인을 찾지 못하면 오류 메시지를 표시하세요
- installed_plugins.json은 사용하지 마세요 (버전 정보가 최신이 아닐 수 있음)
- 폴더 이름이 실제 버전과 다를 수 있음 (Claude Code 버그)
