/**
 * stdin JSON parser for Claude Code Status Line
 */
import { createInterface } from 'readline';
/**
 * stdin 읽기 timeout (ms)
 * Claude Code가 stdin을 바로 닫지 않는 경우 blocking 방지
 */
const STDIN_TIMEOUT_MS = 100;
/**
 * stdin에서 JSON 데이터를 읽어 파싱
 * @returns 파싱된 StatusLineInput 또는 null (파싱 실패/빈 stdin/timeout)
 */
export async function parseStdin() {
    // Windows에서 readline의 stdin 처리 시 assertion 에러 발생 가능
    // stdin 파싱은 선택적 기능이므로 안정성을 위해 비활성화
    // TODO: Windows에서 안전한 stdin 처리 방법 연구 필요
    return null;
    // stdin에 데이터가 있는지 확인 (파이프 없이 실행 시 TTY)
    if (process.stdin.isTTY) {
        return null;
    }
    let rl = null;
    let timeoutId = null;
    const cleanup = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (rl) {
            rl.close();
            rl = null;
        }
        // Note: process.stdin.destroy()는 Windows에서 assertion 에러를 발생시킬 수 있음
        // readline.close()가 stdin을 자동으로 정리하므로 명시적 destroy 불필요
    };
    const readPromise = new Promise((resolve) => {
        let data = '';
        rl = createInterface({ input: process.stdin });
        rl.on('line', (line) => {
            data += line;
        });
        rl.on('close', () => {
            if (!data.trim()) {
                resolve(null);
                return;
            }
            try {
                resolve(JSON.parse(data));
            }
            catch {
                resolve(null);
            }
        });
    });
    const timeoutPromise = new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(null), STDIN_TIMEOUT_MS);
    });
    try {
        return await Promise.race([readPromise, timeoutPromise]);
    }
    finally {
        cleanup();
    }
}
