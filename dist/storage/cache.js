/**
 * Cache module for API response caching
 * TTL: 30 seconds (configurable)
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fetchUsage as fetchUsageFromApi } from '../api/usage.js';
import { getBaseDataDir } from './init.js';
import { isTestMode, getMockUsageResponse } from '../api/mock.js';
const DEFAULT_CACHE_TTL_SECONDS = 30;
/**
 * 캐시 파일 경로 반환
 * @returns 캐시 파일의 절대 경로
 */
export function getCachePath() {
    return join(getBaseDataDir(), 'cache', 'usage-cache.json');
}
/**
 * 캐시 유효성 검사
 * @param cachedAt ISO 8601 timestamp
 * @param ttlSeconds TTL (기본값: 30초)
 * @returns 캐시가 유효하면 true
 */
export function isCacheValid(cachedAt, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
    const cachedTime = new Date(cachedAt).getTime();
    const now = Date.now();
    return (now - cachedTime) < (ttlSeconds * 1000);
}
/**
 * 캐시 읽기
 * 캐시 hit 시 UsageResponse 반환, miss 또는 오류 시 null 반환
 * @returns UsageResponse | null
 */
export async function readCache() {
    try {
        const cachePath = getCachePath();
        const content = await readFile(cachePath, 'utf-8');
        const cacheData = JSON.parse(content);
        if (!isCacheValid(cacheData.cachedAt)) {
            return null; // 캐시 만료
        }
        return cacheData.data;
    }
    catch {
        return null; // 파일 없음 또는 파싱 실패
    }
}
/**
 * 캐시 쓰기
 * 쓰기 실패 시 에러 무시 (silent fail)
 * @param data UsageResponse
 */
export async function writeCache(data) {
    try {
        const cachePath = getCachePath();
        await mkdir(dirname(cachePath), { recursive: true });
        const cacheData = {
            data,
            cachedAt: new Date().toISOString(),
        };
        await writeFile(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    }
    catch {
        // 쓰기 실패 시 무시 (AC 6)
    }
}
/**
 * 캐시를 활용한 Usage 조회
 * 캐시 hit 시 API 호출 스킵, miss 시 API 호출 후 캐시 갱신
 * 테스트 모드에서는 mock 데이터 반환 (AC 1, 2, 5)
 * @returns UsageResponse
 */
export async function fetchUsageWithCache() {
    // 테스트 모드: mock 데이터 반환 (토큰 읽기/갱신 스킵 - AC 5)
    if (isTestMode()) {
        return getMockUsageResponse();
    }
    // 1. 캐시 확인
    const cached = await readCache();
    if (cached) {
        return cached; // 캐시 hit
    }
    // 2. API 호출
    const data = await fetchUsageFromApi();
    // 3. 캐시 저장
    await writeCache(data);
    return data;
}
