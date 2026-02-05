/**
 * Status Line CLI Entry Point
 * Claude Code status line 통합을 위한 독립 CLI
 */
import { parseStdin } from './utils/stdin-parser.js';
import { formatStatusLine, formatLoadingStatusLine } from './display/formatter.js';
import { fetchUsageWithCache, readCache } from './storage/cache.js';
import { isTestMode } from './api/mock.js';
import { recordUsage } from './storage/recorder.js';
import { autoFixVersion } from './utils/version-fix.js';
async function main() {
    try {
        // 0. 버전 불일치 자동 수정 (Claude Code 캐시 버그 workaround)
        await autoFixVersion();
        // 1. stdin 파싱 (선택적 - Claude Code에서 전달하는 세션 정보)
        const stdinData = await parseStdin();
        // 2. 테스트 모드: 기존 동작 유지
        if (isTestMode()) {
            const usage = await fetchUsageWithCache();
            const output = formatStatusLine(usage);
            process.stdout.write(output);
            return;
        }
        // 3. 캐시 확인 (API 호출 없음)
        const cached = await readCache();
        if (cached) {
            // 캐시 hit: 실제 데이터 출력
            const output = formatStatusLine(cached);
            process.stdout.write(output);
            // 데이터 기록 (비동기, silent fail)
            await recordUsage(cached, stdinData).catch(() => { });
        }
        else {
            // 캐시 miss: API 호출 후 실제 데이터 출력
            const usage = await fetchUsageWithCache().catch(() => null);
            if (usage) {
                const output = formatStatusLine(usage);
                process.stdout.write(output);
            }
            else {
                // API 호출 실패 시 fallback
                process.stdout.write(formatLoadingStatusLine());
            }
        }
        // 자연스러운 종료 (모든 핸들 정리 후 Node.js가 자동 종료)
    }
    catch {
        // 에러 시에도 안정적으로 종료 (Claude Code status line 안정성)
        process.stdout.write('📊 사용량 조회 실패');
    }
}
main();
