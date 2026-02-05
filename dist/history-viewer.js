/**
 * Interactive History Viewer CLI (Story 11.7)
 *
 * 인터랙티브 히스토리 뷰어의 독립 실행 진입점입니다.
 * 캘린더 뷰에서 시작하여 상세 뷰, 비교 뷰, 히스토그램 뷰 간 전환이 가능합니다.
 */
import { createHistoryViewerApp } from './ui/views/index.js';
import { t } from './utils/i18n.js';
async function main() {
    await createHistoryViewerApp();
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${t('error.prefix')}: ${message}\n`);
    process.exit(1);
});
