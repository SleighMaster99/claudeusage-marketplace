/**
 * Usage API Client for Claude Usage MCP Server
 */
import { UsageError, ErrorCode, ErrorMessages } from '../utils/errors.js';
import { getValidAccessToken } from './auth.js';
import { isTestMode, getMockUsageResponse } from './mock.js';
const USAGE_API_URL = 'https://api.anthropic.com/api/oauth/usage';
const API_TIMEOUT_MS = 5000;
function normalizeUtilization(value) {
    // 이미 소수점 형식 (0 < value < 1)이면 그대로 반환
    if (value > 0 && value < 1) {
        return value;
    }
    // 정수 퍼센트 형식 (0, 1, 2, ... 100)이면 소수점으로 변환
    return value / 100;
}
export async function fetchUsage() {
    // AC 5: 테스트 모드 시 토큰 읽기/갱신 스킵, mock 데이터 반환
    if (isTestMode()) {
        return getMockUsageResponse();
    }
    const accessToken = await getValidAccessToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
        const response = await fetch(USAGE_API_URL, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'anthropic-beta': 'oauth-2025-04-20',
            },
            signal: controller.signal,
        });
        if (!response.ok) {
            if (response.status === 401) {
                throw new UsageError(ErrorMessages[ErrorCode.TOKEN_EXPIRED], ErrorCode.TOKEN_EXPIRED);
            }
            if (response.status === 429) {
                throw new UsageError(ErrorMessages[ErrorCode.RATE_LIMITED], ErrorCode.RATE_LIMITED, true);
            }
            if (response.status >= 500) {
                throw new UsageError(ErrorMessages[ErrorCode.SERVER_ERROR], ErrorCode.SERVER_ERROR, true);
            }
            throw new UsageError(`API 오류: ${response.status}`, ErrorCode.SERVER_ERROR);
        }
        const data = (await response.json());
        return {
            five_hour: {
                utilization: normalizeUtilization(data.five_hour.utilization),
                resets_at: data.five_hour.resets_at,
            },
            seven_day: {
                utilization: normalizeUtilization(data.seven_day.utilization),
                resets_at: data.seven_day.resets_at,
            },
        };
    }
    catch (error) {
        if (error instanceof UsageError) {
            throw error;
        }
        if (error instanceof Error && error.name === 'AbortError') {
            throw new UsageError(ErrorMessages[ErrorCode.NETWORK_ERROR], ErrorCode.NETWORK_ERROR, true);
        }
        throw new UsageError(ErrorMessages[ErrorCode.NETWORK_ERROR], ErrorCode.NETWORK_ERROR, true);
    }
    finally {
        clearTimeout(timeoutId);
    }
}
