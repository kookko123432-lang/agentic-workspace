import JSZip from 'jszip';

const DATA_KEYS = [
    'agentic_folders',
    'agentic_agents',
    'agentic_rooms',
    'agentic_room_agents',
    'agentic_messages',
    'agentic_ai_settings',
];

export interface ExportManifest {
    version: number;
    exportedAt: string;
    appVersion: string;
    dataKeys: string[];
}

/**
 * Export all user data as a downloadable ZIP file.
 * Structure:
 *   manifest.json        — metadata about the export
 *   data/folders.json    — all folders
 *   data/agents.json     — all agents
 *   data/rooms.json      — all rooms
 *   data/room_agents.json
 *   data/messages.json
 *   data/ai_settings.json
 */
export async function exportAllData(): Promise<void> {
    const zip = new JSZip();

    // Manifest
    const manifest: ExportManifest = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        dataKeys: DATA_KEYS,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Data files
    const dataFolder = zip.folder('data')!;
    for (const key of DATA_KEYS) {
        const raw = localStorage.getItem(key);
        const filename = key.replace('agentic_', '') + '.json';
        dataFolder.file(filename, raw || '[]');
    }

    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(blob, `agentic-backup-${timestamp}.zip`);
}

/**
 * Import user data from a ZIP file, merging or replacing existing data.
 * Returns a summary of what was imported.
 */
export async function importAllData(file: File): Promise<string> {
    const zip = await JSZip.loadAsync(file);

    // Validate manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
        throw new Error('Invalid backup file: missing manifest.json');
    }
    const manifest: ExportManifest = JSON.parse(await manifestFile.async('text'));
    if (manifest.version !== 1) {
        throw new Error(`Unsupported backup version: ${manifest.version}`);
    }

    // Restore each data key
    let restoredCount = 0;
    for (const key of DATA_KEYS) {
        const filename = 'data/' + key.replace('agentic_', '') + '.json';
        const dataFile = zip.file(filename);
        if (dataFile) {
            const content = await dataFile.async('text');
            localStorage.setItem(key, content);
            restoredCount++;
        }
    }

    return `Successfully restored ${restoredCount} data files from backup (${manifest.exportedAt}).`;
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
