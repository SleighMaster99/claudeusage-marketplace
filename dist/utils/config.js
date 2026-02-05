/**
 * Configuration module (Story 3.2, 9.6)
 * Manages user settings from config file
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { getBaseDataDir } from '../storage/init.js';
/**
 * 기본 설정값
 */
export const DEFAULT_SETTINGS = {
    cacheTtlSeconds: 30,
    language: 'ko',
    currency: 'USD',
    exchangeRate: 1300,
    graphStyle: 'bar',
};
/**
 * 캐시된 설정
 */
let cachedSettings = null;
let settingsLoaded = false;
/**
 * 설정 파일 경로 반환
 * @returns 설정 파일의 절대 경로
 */
export function getSettingsPath() {
    return join(getBaseDataDir(), 'config', 'settings.json');
}
/**
 * 설정 파일 로드 (AC 3, 4)
 * - 파일이 없으면 기본값 사용 (자동 생성 안 함)
 * - 포맷 오류 시 기본값 사용
 * @returns Settings 객체
 */
export function loadSettings() {
    if (settingsLoaded && cachedSettings !== null) {
        return cachedSettings;
    }
    try {
        const settingsPath = getSettingsPath();
        const content = readFileSync(settingsPath, 'utf-8');
        const parsed = JSON.parse(content);
        // 타입 검증
        if (!isValidSettings(parsed)) {
            // AC 4: 포맷 오류 시 기본값 사용 (경고는 호출자에서 처리)
            cachedSettings = {};
            settingsLoaded = true;
            return cachedSettings;
        }
        cachedSettings = parsed;
        settingsLoaded = true;
        return cachedSettings;
    }
    catch {
        // AC 3: 파일 없음 시 기본값 사용
        cachedSettings = {};
        settingsLoaded = true;
        return cachedSettings;
    }
}
/**
 * Settings 객체 유효성 검증
 */
function isValidSettings(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const settings = obj;
    // cacheTtlSeconds 검증
    if (settings.cacheTtlSeconds !== undefined) {
        if (typeof settings.cacheTtlSeconds !== 'number' || settings.cacheTtlSeconds < 1) {
            return false;
        }
    }
    // language 검증
    if (settings.language !== undefined) {
        if (settings.language !== 'ko' && settings.language !== 'en') {
            return false;
        }
    }
    // currency 검증 (Story 9.6)
    if (settings.currency !== undefined) {
        if (settings.currency !== 'USD' && settings.currency !== 'KRW') {
            return false;
        }
    }
    // exchangeRate 검증 (Story 9.6)
    if (settings.exchangeRate !== undefined) {
        if (typeof settings.exchangeRate !== 'number' || settings.exchangeRate < 1) {
            return false;
        }
    }
    // graphStyle 검증 (Story 9.6)
    if (settings.graphStyle !== undefined) {
        if (settings.graphStyle !== 'bar' && settings.graphStyle !== 'line') {
            return false;
        }
    }
    return true;
}
/**
 * 설정값 가져오기 (AC 6: 환경변수 우선)
 * @param key 설정 키
 * @returns 설정값 (환경변수 > 설정파일 > 기본값)
 */
export function getSetting(key) {
    const settings = loadSettings();
    // AC 6: 환경 변수가 설정 파일보다 우선
    if (key === 'language') {
        const envLang = process.env.CLUSAGE_LANG;
        if (envLang === 'ko' || envLang === 'en') {
            return envLang;
        }
    }
    if (key === 'cacheTtlSeconds') {
        const envTtl = process.env.CLUSAGE_CACHE_TTL;
        if (envTtl) {
            const ttl = parseInt(envTtl, 10);
            if (!isNaN(ttl) && ttl >= 1) {
                return ttl;
            }
        }
    }
    // 설정 파일 값 또는 기본값
    const value = settings[key] ?? DEFAULT_SETTINGS[key];
    return value;
}
/**
 * 모든 현재 설정 반환 (AC 5: config 명령어용)
 * @returns 전체 설정 객체 (환경변수 적용됨)
 */
export function getAllSettings() {
    return {
        cacheTtlSeconds: getSetting('cacheTtlSeconds'),
        language: getSetting('language'),
        currency: getSetting('currency'),
        exchangeRate: getSetting('exchangeRate'),
        graphStyle: getSetting('graphStyle'),
    };
}
/**
 * 설정 캐시 초기화 (테스트용)
 */
export function resetSettingsCache() {
    cachedSettings = null;
    settingsLoaded = false;
}
/**
 * 설정 파일이 존재하고 유효한지 확인
 * @returns true if settings file exists and is valid
 */
export function hasValidSettingsFile() {
    try {
        const settingsPath = getSettingsPath();
        const content = readFileSync(settingsPath, 'utf-8');
        const parsed = JSON.parse(content);
        return isValidSettings(parsed);
    }
    catch {
        return false;
    }
}
/**
 * 설정 저장 (Story 9.6)
 * @param settings 저장할 설정 객체
 */
export function saveSettings(settings) {
    const settingsPath = getSettingsPath();
    const settingsDir = dirname(settingsPath);
    // 디렉토리가 없으면 생성
    if (!existsSync(settingsDir)) {
        mkdirSync(settingsDir, { recursive: true });
    }
    // JSON 포맷으로 저장 (가독성을 위해 2칸 들여쓰기)
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    // 캐시 초기화 (다음 로드 시 새 설정 반영)
    resetSettingsCache();
}
/**
 * 개별 설정 업데이트 (Story 9.6)
 * @param key 설정 키
 * @param value 설정 값
 */
export function updateSetting(key, value) {
    // 현재 설정 로드
    const currentSettings = loadSettings();
    // 값 업데이트
    const updatedSettings = {
        ...currentSettings,
        [key]: value,
    };
    // 저장
    saveSettings(updatedSettings);
}
