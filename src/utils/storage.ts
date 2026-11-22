import { SaveData } from '../types/game';

export const SAVE_VERSION = 2;
const STORAGE_KEY = 'popbilles_save_v1';
const IDB_NAME = 'PopBillesDB';
const IDB_STORE = 'saves';
const IDB_KEY = 'primary_save';

const DEFAULT_OWNED_ITEMS = [
  'skin_classic',
  'acc_none',
  'theme_wood',
  'fx_sparkles',
];

export function createDefaultSaveData(): SaveData {
  return {
    version: SAVE_VERSION,
    lastSavedAt: new Date().toISOString(),
    coins: 25,
    redeemedPromoCodes: [],
    discoveredLevels: [1, 2, 3, 4, 5],
    ownedShopItems: [...DEFAULT_OWNED_ITEMS],
    equipped: {
      skin: 'classic',
      accessory: 'none',
      theme: 'wood',
      effect: 'sparkles',
    },
    stats: {
      bestScore: 0,
      totalScore: 0,
      gamesPlayed: 0,
      totalMerges: 0,
      totalBallsDropped: 0,
      highestLevelEver: 5,
      maxComboEver: 0,
      supernovas: 0,
      mergesByLevel: {},
    },
    settings: {
      sfxEnabled: true,
      sfxVolume: 0.7,
      musicEnabled: false,
      musicVolume: 0.35,
      reducedEffects: false,
      showTrajectory: true,
    },
  };
}

function sanitizeSaveData(raw: unknown): SaveData {
  const base = createDefaultSaveData();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;

  const ownedSet = new Set<string>([
    ...DEFAULT_OWNED_ITEMS,
    ...(Array.isArray(r.ownedShopItems) ? r.ownedShopItems : []),
  ]);

  const discoveredSet = new Set<number>([
    1,
    2,
    3,
    4,
    5,
    ...(Array.isArray(r.discoveredLevels)
      ? r.discoveredLevels.filter((n) => typeof n === 'number' && n >= 1 && n <= 11)
      : []),
  ]);

  const promoSet = new Set<string>(
    Array.isArray(r.redeemedPromoCodes)
      ? r.redeemedPromoCodes.filter((c): c is string => typeof c === 'string')
      : []
  );

  return {
    version: SAVE_VERSION,
    lastSavedAt: typeof r.lastSavedAt === 'string' ? r.lastSavedAt : base.lastSavedAt,
    coins:
      typeof r.coins === 'number' && Number.isFinite(r.coins)
        ? Math.max(0, Math.floor(r.coins))
        : base.coins,
    redeemedPromoCodes: Array.from(promoSet),
    discoveredLevels: Array.from(discoveredSet).sort((a, b) => a - b),
    ownedShopItems: Array.from(ownedSet),
    equipped: {
      skin: r.equipped?.skin || base.equipped.skin,
      accessory: r.equipped?.accessory || base.equipped.accessory,
      theme: r.equipped?.theme || base.equipped.theme,
      effect: r.equipped?.effect || base.equipped.effect,
    },
    stats: {
      bestScore: Math.max(0, Number(r.stats?.bestScore) || 0),
      totalScore: Math.max(0, Number(r.stats?.totalScore) || 0),
      gamesPlayed: Math.max(0, Number(r.stats?.gamesPlayed) || 0),
      totalMerges: Math.max(0, Number(r.stats?.totalMerges) || 0),
      totalBallsDropped: Math.max(0, Number(r.stats?.totalBallsDropped) || 0),
      highestLevelEver: Math.max(5, Math.min(11, Number(r.stats?.highestLevelEver) || 5)),
      maxComboEver: Math.max(0, Number(r.stats?.maxComboEver) || 0),
      supernovas: Math.max(0, Number(r.stats?.supernovas) || 0),
      mergesByLevel:
        r.stats?.mergesByLevel && typeof r.stats.mergesByLevel === 'object'
          ? { ...r.stats.mergesByLevel }
          : {},
    },
    settings: {
      sfxEnabled:
        typeof r.settings?.sfxEnabled === 'boolean'
          ? r.settings.sfxEnabled
          : base.settings.sfxEnabled,
      sfxVolume:
        typeof r.settings?.sfxVolume === 'number'
          ? Math.min(1, Math.max(0, r.settings.sfxVolume))
          : base.settings.sfxVolume,
      musicEnabled:
        typeof r.settings?.musicEnabled === 'boolean'
          ? r.settings.musicEnabled
          : base.settings.musicEnabled,
      musicVolume:
        typeof r.settings?.musicVolume === 'number'
          ? Math.min(1, Math.max(0, r.settings.musicVolume))
          : base.settings.musicVolume,
      reducedEffects:
        typeof r.settings?.reducedEffects === 'boolean'
          ? r.settings.reducedEffects
          : base.settings.reducedEffects,
      showTrajectory:
        typeof r.settings?.showTrajectory === 'boolean'
          ? r.settings.showTrajectory
          : base.settings.showTrajectory,
    },
  };
}

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function mirrorToIndexedDB(data: SaveData): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(data, IDB_KEY);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  } catch {
    db.close();
  }
}

export async function restoreFromIndexedDBIfNeeded(): Promise<SaveData | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        db.close();
        if (req.result) {
          resolve(sanitizeSaveData(req.result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSaveData();
    const parsed = JSON.parse(raw);
    return sanitizeSaveData(parsed);
  } catch {
    return createDefaultSaveData();
  }
}

export function persistSaveData(data: SaveData): { ok: boolean; error?: string } {
  const payload: SaveData = {
    ...data,
    version: SAVE_VERSION,
    lastSavedAt: new Date().toISOString(),
  };

  let lsOk = false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    lsOk = true;
  } catch {
    lsOk = false;
  }

  void mirrorToIndexedDB(payload);

  if (!lsOk) {
    return {
      ok: false,
      error: 'Stockage local indisponible ou saturé. Sauvegarde miroir tentée dans IndexedDB.',
    };
  }
  return { ok: true };
}

export async function clearAllSaveData(): Promise<SaveData> {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage error
  }
  const db = await openDatabase();
  if (db) {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch {
      db.close();
    }
  }
  const fresh = createDefaultSaveData();
  persistSaveData(fresh);
  return fresh;
}

export function exportSaveDataJson(data: SaveData): string {
  return JSON.stringify(data, null, 2);
}

export function importSaveDataJson(
  jsonString: string
): { ok: true; data: SaveData } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number') {
      return { ok: false, error: 'Fichier de sauvegarde invalide ou corrompu.' };
    }
    const clean = sanitizeSaveData(parsed);
    persistSaveData(clean);
    return { ok: true, data: clean };
  } catch {
    return { ok: false, error: 'Impossible de lire le fichier JSON.' };
  }
}
