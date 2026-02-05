/**
 * Version Fix Utility
 * Claude Code 플러그인 시스템의 버전 캐시 버그를 자동 수정
 */
import { readFile, writeFile, rename, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
const PLUGIN_KEY = 'claudeusage@claudeusage-marketplace';
/**
 * 현재 플러그인의 실제 버전을 가져옴
 */
async function getActualVersion() {
    try {
        // 현재 실행 중인 스크립트 위치에서 package.json 찾기
        const scriptDir = dirname(new URL(import.meta.url).pathname);
        // Windows 경로 수정 (/C:/... -> C:/...)
        const normalizedDir = scriptDir.replace(/^\/([A-Za-z]:)/, '$1');
        const packagePath = join(normalizedDir, '..', '..', 'package.json');
        const content = await readFile(packagePath, 'utf-8');
        const pkg = JSON.parse(content);
        return pkg.version || null;
    }
    catch {
        return null;
    }
}
/**
 * installed_plugins.json에서 등록된 버전 정보를 가져옴
 */
async function getRegisteredInfo() {
    try {
        const installedPath = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
        const content = await readFile(installedPath, 'utf-8');
        const data = JSON.parse(content);
        const entries = data.plugins[PLUGIN_KEY];
        if (!entries || entries.length === 0)
            return null;
        return {
            version: entries[0].version,
            installPath: entries[0].installPath
        };
    }
    catch {
        return null;
    }
}
/**
 * 캐시 폴더 이름과 installed_plugins.json을 수정
 */
async function fixVersion(actualVersion, registeredInfo) {
    try {
        const oldPath = registeredInfo.installPath;
        const newPath = oldPath.replace(/[\\/][^\\/]+$/, `/${actualVersion}`);
        // 새 경로가 이미 존재하는지 확인
        try {
            await access(newPath);
            // 이미 존재하면 스킵
            return false;
        }
        catch {
            // 존재하지 않으면 계속
        }
        // 1. 폴더 이름 변경
        await rename(oldPath, newPath);
        // 2. installed_plugins.json 업데이트
        const installedPath = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
        const content = await readFile(installedPath, 'utf-8');
        const data = JSON.parse(content);
        if (data.plugins[PLUGIN_KEY] && data.plugins[PLUGIN_KEY].length > 0) {
            data.plugins[PLUGIN_KEY][0].version = actualVersion;
            data.plugins[PLUGIN_KEY][0].installPath = newPath.replace(/\//g, '\\');
            data.plugins[PLUGIN_KEY][0].lastUpdated = new Date().toISOString();
            await writeFile(installedPath, JSON.stringify(data, null, 2));
        }
        return true;
    }
    catch {
        return false;
    }
}
/**
 * 버전 불일치 시 자동 수정 (silent)
 */
export async function autoFixVersion() {
    try {
        const actualVersion = await getActualVersion();
        if (!actualVersion)
            return;
        const registeredInfo = await getRegisteredInfo();
        if (!registeredInfo)
            return;
        // 버전이 다르면 수정
        if (actualVersion !== registeredInfo.version) {
            await fixVersion(actualVersion, registeredInfo);
        }
    }
    catch {
        // Silent fail - 버전 수정 실패해도 플러그인 동작에는 영향 없음
    }
}
