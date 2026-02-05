/**
 * Mock data for test mode (Story 2.5)
 * Provides mock API responses when CLUSAGE_TEST_MODE=true
 */
/**
 * 테스트 모드 활성화 여부 확인
 * @returns true if CLUSAGE_TEST_MODE=true
 */
export function isTestMode() {
    return process.env.CLUSAGE_TEST_MODE === 'true';
}
/**
 * 테스트 모드용 mock 사용량 데이터
 * AC 2: five_hour: 45%, seven_day: 12%
 */
export function getMockUsageResponse() {
    const now = new Date();
    // 5시간 후 리셋 (세션)
    const fiveHourReset = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    // 7일 후 리셋 (주간)
    const sevenDayReset = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
        five_hour: {
            utilization: 0.45,
            resets_at: fiveHourReset.toISOString(),
        },
        seven_day: {
            utilization: 0.12,
            resets_at: sevenDayReset.toISOString(),
        },
    };
}
/**
 * 테스트 모드 표시 프리픽스
 * AC 3: [TEST MODE] 표시
 */
export const TEST_MODE_PREFIX = '[TEST MODE] ';
