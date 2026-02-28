/**
 * IndexedDB-based file storage for workspace files.
 * Uses IndexedDB instead of localStorage to handle larger binary files.
 */
import { WorkspaceFile } from './types';

const DB_NAME = 'agentic_files_db';
const DB_VERSION = 1;
const STORE_META = 'file_meta';
const STORE_BLOBS = 'file_blobs';

// ─── Database initialization ────────────────────────────────

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_META)) {
                db.createObjectStore(STORE_META, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_BLOBS)) {
                db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ─── Text extraction ────────────────────────────────────────

const TEXT_EXTENSIONS = new Set([
    'txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'xml', 'yaml', 'yml',
    'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go',
    'java', 'c', 'cpp', 'h', 'rs', 'sh', 'bash', 'zsh', 'sql', 'env',
    'toml', 'ini', 'cfg', 'conf', 'log', 'svg', 'gitignore', 'dockerfile',
]);

function isTextFile(filename: string, mimeType: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (TEXT_EXTENSIONS.has(ext)) return true;
    if (mimeType.startsWith('text/')) return true;
    if (mimeType === 'application/json') return true;
    if (mimeType === 'application/xml') return true;
    return false;
}

async function extractText(file: File): Promise<string> {
    if (!isTextFile(file.name, file.type)) return '';
    try {
        const text = await file.text();
        // Cap at 200KB of text to avoid huge storage
        return text.slice(0, 200_000);
    } catch {
        return '';
    }
}

// ─── Public API ─────────────────────────────────────────────

export async function saveFile(
    folderId: string,
    file: File,
    id: string
): Promise<WorkspaceFile> {
    const db = await openDB();
    const content = await extractText(file);

    const meta: WorkspaceFile = {
        id,
        folder_id: folderId,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        content,
        created_at: new Date().toISOString(),
    };

    // Store metadata
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).put(meta);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });

    // Store blob data
    const arrayBuffer = await file.arrayBuffer();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, 'readwrite');
        tx.objectStore(STORE_BLOBS).put({ id, data: arrayBuffer, name: file.name, type: file.type });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });

    db.close();
    return meta;
}

export async function getFilesByFolder(folderId: string): Promise<WorkspaceFile[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const store = tx.objectStore(STORE_META);
        const request = store.getAll();
        request.onsuccess = () => {
            const all = request.result as WorkspaceFile[];
            db.close();
            resolve(
                all
                    .filter(f => f.folder_id === folderId)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            );
        };
        request.onerror = () => { db.close(); reject(request.error); };
    });
}

export async function getFileById(id: string): Promise<WorkspaceFile | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const request = tx.objectStore(STORE_META).get(id);
        request.onsuccess = () => { db.close(); resolve(request.result || null); };
        request.onerror = () => { db.close(); reject(request.error); };
    });
}

export async function getFileBlob(id: string): Promise<Blob | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, 'readonly');
        const request = tx.objectStore(STORE_BLOBS).get(id);
        request.onsuccess = () => {
            db.close();
            if (request.result) {
                resolve(new Blob([request.result.data], { type: request.result.type }));
            } else {
                resolve(null);
            }
        };
        request.onerror = () => { db.close(); reject(request.error); };
    });
}

export async function deleteFile(id: string): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
        tx.objectStore(STORE_META).delete(id);
        tx.objectStore(STORE_BLOBS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function deleteFilesByFolder(folderId: string): Promise<void> {
    const files = await getFilesByFolder(folderId);
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
        for (const f of files) {
            tx.objectStore(STORE_META).delete(f.id);
            tx.objectStore(STORE_BLOBS).delete(f.id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function getAllFiles(): Promise<WorkspaceFile[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const request = tx.objectStore(STORE_META).getAll();
        request.onsuccess = () => { db.close(); resolve(request.result || []); };
        request.onerror = () => { db.close(); reject(request.error); };
    });
}

export async function getAllFileBlobs(): Promise<{ id: string; data: ArrayBuffer; name: string; type: string }[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, 'readonly');
        const request = tx.objectStore(STORE_BLOBS).getAll();
        request.onsuccess = () => { db.close(); resolve(request.result || []); };
        request.onerror = () => { db.close(); reject(request.error); };
    });
}

export async function importFile(meta: WorkspaceFile, blobData: ArrayBuffer): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
        tx.objectStore(STORE_META).put(meta);
        tx.objectStore(STORE_BLOBS).put({ id: meta.id, data: blobData, name: meta.name, type: meta.type });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

// ─── Utilities ──────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, string> = {
        md: '📝', txt: '📄', json: '🔧', csv: '📊', tsv: '📊',
        html: '🌐', css: '🎨', js: '⚡', jsx: '⚛️', ts: '💎', tsx: '⚛️',
        py: '🐍', rb: '💎', go: '🔵', java: '☕', rs: '🦀',
        png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
        pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', ppt: '📙', pptx: '📙',
        zip: '📦', tar: '📦', gz: '📦', rar: '📦',
        mp3: '🎵', wav: '🎵', mp4: '🎬', mov: '🎬',
        sql: '🗃️', xml: '📋', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
        sh: '🖥️', bash: '🖥️', dockerfile: '🐳',
    };
    return iconMap[ext] || '📄';
}
