/**
 * Cost Calculator (Story 9.4)
 * Calculates API costs from token usage
 */
/**
 * 모델별 가격 테이블 (MTok = Million Tokens)
 * Claude API 요금 2026년 1월 기준
 */
export const MODEL_PRICING = {
    opus: { inputPricePerMTok: 15, outputPricePerMTok: 75 },
    sonnet: { inputPricePerMTok: 3, outputPricePerMTok: 15 },
    haiku: { inputPricePerMTok: 0.25, outputPricePerMTok: 1.25 },
};
/**
 * 캐시 할인율 (90% 할인 = 정가의 10%만 부과)
 */
export const CACHE_DISCOUNT_RATE = 0.9;
/**
 * 기본 환율 (KRW/USD)
 */
export const DEFAULT_EXCHANGE_RATE = 1300;
/**
 * 모델 이름으로 가격 정보 조회
 * @param modelName - 모델 이름 (대소문자 무시)
 * @returns 가격 정보 또는 null (미지원 모델)
 */
export function getModelPricing(modelName) {
    const normalized = modelName.toLowerCase();
    return MODEL_PRICING[normalized] ?? null;
}
/**
 * 토큰 비용 계산
 * @param tokens - 토큰 수
 * @param pricePerMTok - MTok당 가격 (USD)
 * @returns 비용 (USD, 소수점 6자리)
 */
export function calculateTokenCost(tokens, pricePerMTok) {
    const cost = (tokens / 1_000_000) * pricePerMTok;
    return Number(cost.toFixed(6));
}
/**
 * 캐시 할인액 계산
 * @param cacheTokens - 캐시 토큰 수 (cache_creation + cache_read)
 * @param pricePerMTok - MTok당 입력 가격 (USD)
 * @returns 할인액 (USD)
 */
export function calculateCacheDiscount(cacheTokens, pricePerMTok) {
    const discount = (cacheTokens / 1_000_000) * pricePerMTok * CACHE_DISCOUNT_RATE;
    return Number(discount.toFixed(6));
}
/**
 * 단일 레코드의 비용 계산
 * @param record - 사용량 레코드
 * @returns 비용 계산 결과 또는 null (토큰 정보 없음)
 */
export function calculateRecordCost(record) {
    if (!record.tokens) {
        return null;
    }
    // 모델 가격 조회 (없으면 Sonnet 기본값)
    const modelName = record.model ?? 'sonnet';
    const pricing = getModelPricing(modelName) ?? MODEL_PRICING.sonnet;
    const { input, output, cache_creation, cache_read } = record.tokens;
    const totalCacheTokens = cache_creation + cache_read;
    // 입력 비용: input 토큰 정가 + 캐시 토큰 할인가 (정가의 10%)
    const inputBaseCost = calculateTokenCost(input, pricing.inputPricePerMTok);
    const cacheCost = calculateTokenCost(totalCacheTokens, pricing.inputPricePerMTok * (1 - CACHE_DISCOUNT_RATE));
    const inputCostUsd = Number((inputBaseCost + cacheCost).toFixed(6));
    // 출력 비용
    const outputCostUsd = calculateTokenCost(output, pricing.outputPricePerMTok);
    // 캐시 할인액 (정가 대비 절약 금액)
    const cacheDiscountUsd = calculateCacheDiscount(totalCacheTokens, pricing.inputPricePerMTok);
    // 총 비용
    const totalCostUsd = Number((inputCostUsd + outputCostUsd).toFixed(6));
    return {
        inputCostUsd,
        outputCostUsd,
        cacheDiscountUsd,
        totalCostUsd,
    };
}
/**
 * USD를 KRW로 환산
 * @param usd - USD 금액
 * @param exchangeRate - 환율 (기본값: 1300)
 * @returns KRW 금액 (정수, 소수점 버림)
 */
export function convertToKrw(usd, exchangeRate = DEFAULT_EXCHANGE_RATE) {
    return Math.floor(usd * exchangeRate);
}
/**
 * 여러 레코드의 총 비용 계산
 * @param records - 사용량 레코드 배열
 * @param options - 계산 옵션
 * @returns 총 비용 계산 결과
 */
export function calculateTotalCost(records, options) {
    let totalInputCost = 0;
    let totalOutputCost = 0;
    let totalCacheDiscount = 0;
    for (const record of records) {
        const cost = calculateRecordCost(record);
        if (cost) {
            totalInputCost += cost.inputCostUsd;
            totalOutputCost += cost.outputCostUsd;
            totalCacheDiscount += cost.cacheDiscountUsd;
        }
    }
    const inputCostUsd = Number(totalInputCost.toFixed(6));
    const outputCostUsd = Number(totalOutputCost.toFixed(6));
    const cacheDiscountUsd = Number(totalCacheDiscount.toFixed(6));
    const totalCostUsd = Number((inputCostUsd + outputCostUsd).toFixed(6));
    const result = {
        inputCostUsd,
        outputCostUsd,
        cacheDiscountUsd,
        totalCostUsd,
    };
    if (options?.includeKrw) {
        const exchangeRate = options.exchangeRate ?? DEFAULT_EXCHANGE_RATE;
        result.totalCostKrw = convertToKrw(totalCostUsd, exchangeRate);
    }
    return result;
}
