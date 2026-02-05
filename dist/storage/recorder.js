/**
 * Usage data recorder module (Story 2.4)
 * Records usage data to daily JSON files
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { getBaseDataDir } from './init.js';
/**
 * 일별 데이터 파일 경로 반환
 * @param date - YYYY-MM-DD 형식 날짜 (기본값: 오늘)
 * @returns 파일 경로
 */
export function getDailyFilePath(date) {
    const dateStr = date ?? new Date().toISOString().split('T')[0];
    return join(getBaseDataDir(), 'data', 'daily', `${dateStr}.json`);
}
/**
 * 기존 일별 파일 읽기
 * @param filePath - 파일 경로
 * @returns DailyUsageFile 또는 null (파일 없음/파싱 실패)
 */
export async function readDailyFile(filePath) {
    try {
        const content = await readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * 일별 파일에 기록 저장
 * @param filePath - 파일 경로
 * @param dailyFile - 저장할 데이터
 */
export async function writeDailyFile(filePath, dailyFile) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(dailyFile, null, 2), 'utf-8');
}
/**
 * UsageResponse와 StatusLineInput에서 UsageRecord 생성
 * @param usage - API 응답 데이터
 * @param stdinData - stdin에서 받은 데이터 (선택적)
 * @returns UsageRecord
 */
export function createUsageRecord(usage, stdinData) {
    const record = {
        timestamp: new Date().toISOString(),
        session: {
            utilization: usage.five_hour.utilization,
            resets_at: usage.five_hour.resets_at,
        },
        weekly: {
            utilization: usage.seven_day.utilization,
            resets_at: usage.seven_day.resets_at,
        },
    };
    // stdin 데이터에서 추가 정보 추출
    if (stdinData) {
        if (stdinData.model?.display_name) {
            record.model = stdinData.model.display_name;
        }
        if (stdinData.cost?.total_cost_usd !== undefined) {
            record.cost_usd = stdinData.cost.total_cost_usd;
        }
        const currentUsage = stdinData.context_window?.current_usage;
        if (currentUsage) {
            record.tokens = {
                input: currentUsage.input_tokens ?? 0,
                output: currentUsage.output_tokens ?? 0,
                cache_creation: currentUsage.cache_creation_input_tokens ?? 0,
                cache_read: currentUsage.cache_read_input_tokens ?? 0,
            };
        }
        if (stdinData.cost) {
            const lines_added = stdinData.cost.total_lines_added;
            const lines_removed = stdinData.cost.total_lines_removed;
            if (lines_added !== undefined || lines_removed !== undefined) {
                record.lines = {
                    added: lines_added ?? 0,
                    removed: lines_removed ?? 0,
                };
            }
        }
    }
    return record;
}
/**
 * 사용량 데이터 기록
 * 기존 파일에 append하거나 새 파일 생성
 * 실패해도 예외를 throw하지 않음 (silent fail)
 * @param usage - API 응답 데이터
 * @param stdinData - stdin에서 받은 데이터 (선택적)
 */
export async function recordUsage(usage, stdinData) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const filePath = getDailyFilePath(today);
        // 기존 파일 읽기
        let dailyFile = await readDailyFile(filePath);
        // 파일이 없거나 날짜가 다른 경우 새로 생성
        if (!dailyFile || dailyFile.date !== today) {
            dailyFile = {
                date: today,
                records: [],
            };
        }
        // 새 레코드 추가
        const record = createUsageRecord(usage, stdinData);
        dailyFile.records.push(record);
        // 파일 저장
        await writeDailyFile(filePath, dailyFile);
    }
    catch {
        // AC 5: 파일 쓰기 실패 시에도 CLI 출력은 정상 수행
        // 에러를 무시하고 조용히 종료
    }
}
