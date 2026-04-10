import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AppDB extends DBSchema {
  history: {
    key: string;
    value: {
      id: string;
      file: File;
      status: 'pending' | 'processing' | 'completed' | 'error';
      isAiGenerated: boolean;
      metadata?: {
        title: string;
        description: string;
        keywords: string[];
        categories: string[];
        adobeCategory: string;
      };
      error?: string;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

export async function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>('jorozz-metadata-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('history', { keyPath: 'id' });
        store.createIndex('by-timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
}

export async function saveToHistory(item: any, processedImage?: string) {
  const db = await initDB();
  const dataToSave = { ...item, timestamp: Date.now() };
  if (processedImage) {
    dataToSave.processedImage = processedImage;
  }
  delete dataToSave.preview; // Don't save the object URL
  await db.put('history', dataToSave);
}

export async function getHistory() {
  const db = await initDB();
  const all = await db.getAllFromIndex('history', 'by-timestamp');
  return all.reverse(); // Newest first
}

export async function deleteFromHistory(id: string) {
  const db = await initDB();
  await db.delete('history', id);
}

export async function clearHistory() {
  const db = await initDB();
  await db.clear('history');
}

export async function cleanupOldHistory() {
  const db = await initDB();
  const tx = db.transaction('history', 'readwrite');
  const store = tx.objectStore('history');
  const all = await store.getAll();
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  
  for (const item of all) {
    if (item.timestamp < threeDaysAgo) {
      await store.delete(item.id);
    }
  }
  await tx.done;
}
