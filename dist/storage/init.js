/**
 * Data directory initialization module
 * Handles creation of base data directory and subdirectories
 */
import { mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
const SUB_DIRS = ['data/daily', 'cache', 'config', 'logs'];
/**
 * 기본 데이터 디렉토리 경로 반환
 * Windows: C:\Users\{user}\.claudeusage
 * macOS/Linux: /Users/{user}/.claudeusage 또는 /home/{user}/.claudeusage
 * @returns 기본 데이터 디렉토리의 절대 경로
 */
export function getBaseDataDir() {
    return join(homedir(), '.claudeusage');
}
/**
 * 하위 디렉토리 목록 반환
 * @returns 하위 디렉토리 배열 (읽기 전용)
 */
export function getSubDirs() {
    return SUB_DIRS;
}
/**
 * 데이터 디렉토리 초기화
 * 기본 경로 하위에 모든 필요 디렉토리 생성
 * 이미 존재하는 디렉토리는 에러 없이 스킵됨
 * @throws 권한 오류 시 명확한 에러 메시지와 함께 throw
 */
export async function initializeDataDirectories() {
    const baseDir = getBaseDataDir();
    for (const subDir of SUB_DIRS) {
        const fullPath = join(baseDir, subDir);
        try {
            await mkdir(fullPath, { recursive: true });
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                const nodeError = error;
                if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
                    throw new Error(`디렉토리 생성 권한 오류: ${fullPath}. 권한을 확인하세요.`);
                }
            }
            throw error;
        }
    }
}
