/**
 * History data reader module (Story 9.1)
 * Reads daily JSON files for history analysis
 */
import { readFile } from 'fs/promises';
import { getDailyFilePath } from './recorder.js';
/**
 * 시작일부터 종료일까지의 날짜 배열 생성
 * @param startDate - 시작일 (YYYY-MM-DD)
 * @param endDate - 종료일 (YYYY-MM-DD)
 * @returns 날짜 문자열 배열
 */
export function getDateRange(startDate, endDate) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return dates;
    }
    const current = new Date(start);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}
/**
 * DailyUsageFile 스키마 검증
 * @param data - 검증할 데이터
 * @returns 유효한 DailyUsageFile인지 여부
 */
export function validateDailyUsageFile(data) {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    const obj = data;
    if (typeof obj.date !== 'string') {
        return false;
    }
    if (!Array.isArray(obj.records)) {
        return false;
    }
    return true;
}
/**
 * 단일 파일 읽기 시도
 * @param filePath - 파일 경로
 * @param date - 날짜 (에러 기록용)
 * @returns [DailyUsageFile | null, HistoryReadError | null]
 */
async function tryReadFile(filePath, date) {
    try {
        const content = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (!validateDailyUsageFile(parsed)) {
            return [null, { date, reason: 'Invalid schema' }];
        }
        return [parsed, null];
    }
    catch (error) {
        // 파일 없음은 에러 아님
        if (error instanceof Error && 'code' in error) {
            const code = error.code;
            if (code === 'ENOENT') {
                return [null, null];
            }
            // 권한 오류는 throw
            if (code === 'EACCES') {
                throw error;
            }
        }
        // JSON 파싱 실패 등 기타 에러
        const reason = error instanceof Error ? error.message : 'Unknown error';
        return [null, { date, reason }];
    }
}
/**
 * 날짜 범위 내 히스토리 데이터 읽기
 * @param startDate - 시작일 (YYYY-MM-DD)
 * @param endDate - 종료일 (YYYY-MM-DD)
 * @returns HistoryReadResult
 */
export async function readHistoryData(startDate, endDate) {
    const dates = getDateRange(startDate, endDate);
    const data = [];
    const errors = [];
    for (const date of dates) {
        const filePath = getDailyFilePath(date);
        const [fileData, error] = await tryReadFile(filePath, date);
        if (fileData) {
            data.push(fileData);
        }
        if (error) {
            errors.push(error);
        }
    }
    return {
        success: errors.length === 0,
        data,
        errors,
    };
}
