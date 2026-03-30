import type { Notebook } from '@papergrid/core';

const COVER_DB_NAME = 'papergrid-assets';
const COVER_STORE_NAME = 'notebook-covers';
const COMPRESSED_COVER_TARGET_LENGTH = 350_000;
const MAX_COVER_DIMENSION = 896;
const NOTEBOOK_COVER_ASPECT_RATIO = 3.2 / 4.2;

type NotebookWithoutCover = Omit<Notebook, 'coverImageUrl'>;

function openCoverDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(COVER_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(COVER_STORE_NAME)) {
        db.createObjectStore(COVER_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredCovers(): Promise<Map<string, string>> {
  const db = await openCoverDb();
  if (!db) return new Map();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(COVER_STORE_NAME, 'readonly');
    const store = tx.objectStore(COVER_STORE_NAME);
    const request = store.getAllKeys();
    const entries = new Map<string, string>();

    request.onsuccess = async () => {
      const keys = request.result as string[];
      try {
        await Promise.all(keys.map((key) => new Promise<void>((innerResolve, innerReject) => {
          const getRequest = store.get(key);
          getRequest.onsuccess = () => {
            if (typeof getRequest.result === 'string') {
              entries.set(key, getRequest.result);
            }
            innerResolve();
          };
          getRequest.onerror = () => innerReject(getRequest.error);
        })));
        resolve(entries);
      } catch (error) {
        reject(error);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

async function writeStoredCover(notebookId: string, imageUrl?: string): Promise<void> {
  const db = await openCoverDb();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(COVER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(COVER_STORE_NAME);
    const request = imageUrl ? store.put(imageUrl, notebookId) : store.delete(notebookId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function pruneStoredCovers(activeNotebookIds: string[]): Promise<void> {
  const db = await openCoverDb();
  if (!db) return;

  const activeIds = new Set(activeNotebookIds);
  const existingCovers = await readStoredCovers();

  await Promise.all(
    Array.from(existingCovers.keys())
      .filter((id) => !activeIds.has(id))
      .map((id) => writeStoredCover(id, undefined)),
  );
}

function stripCoverImages(notebooks: Notebook[]): NotebookWithoutCover[] {
  return notebooks.map(({ coverImageUrl: _coverImageUrl, ...notebook }) => notebook);
}

export async function prepareCoverImageForStorage(imageUrl: string): Promise<string> {
  if (
    !imageUrl.startsWith('data:image/') ||
    imageUrl.startsWith('data:image/svg+xml') ||
    imageUrl.length <= COMPRESSED_COVER_TARGET_LENGTH
  ) {
    return imageUrl;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.decoding = 'async';
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Failed to load cover image for compression.'));
    element.src = imageUrl;
  });

  const imageAspectRatio = image.width / image.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (imageAspectRatio > NOTEBOOK_COVER_ASPECT_RATIO) {
    sourceWidth = Math.round(image.height * NOTEBOOK_COVER_ASPECT_RATIO);
    sourceX = Math.max(0, Math.round((image.width - sourceWidth) / 2));
  } else if (imageAspectRatio < NOTEBOOK_COVER_ASPECT_RATIO) {
    sourceHeight = Math.round(image.width / NOTEBOOK_COVER_ASPECT_RATIO);
    sourceY = Math.max(0, Math.round((image.height - sourceHeight) / 2));
  }

  const scale = Math.min(1, MAX_COVER_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return imageUrl;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

  let bestResult = imageUrl;
  for (const quality of [0.92, 0.84, 0.76, 0.68]) {
    const candidate = canvas.toDataURL('image/jpeg', quality);
    if (candidate.length < bestResult.length) {
      bestResult = candidate;
    }
    if (candidate.length <= COMPRESSED_COVER_TARGET_LENGTH) {
      return candidate;
    }
  }

  return bestResult;
}

export async function loadNotebooksFromStorage(storageKey: string): Promise<Notebook[] | null> {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return null;

  const parsed: unknown = JSON.parse(saved);
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !parsed.every((nb: unknown) => typeof nb === 'object' && nb !== null && 'id' in nb && 'pages' in nb)
  ) {
    return null;
  }

  const coverImages = await readStoredCovers().catch(() => new Map<string, string>());

  return (parsed as Notebook[]).map((notebook) => ({
    ...notebook,
    bookmarks: notebook.bookmarks ?? [],
    coverImageUrl: coverImages.get(notebook.id) ?? notebook.coverImageUrl,
  }));
}

export async function saveNotebooksToStorage(storageKey: string, notebooks: Notebook[]): Promise<void> {
  localStorage.setItem(storageKey, JSON.stringify(stripCoverImages(notebooks)));

  await Promise.all(
    notebooks.map((notebook) => writeStoredCover(notebook.id, notebook.coverImageUrl)),
  );

  await pruneStoredCovers(notebooks.map((notebook) => notebook.id));
}
