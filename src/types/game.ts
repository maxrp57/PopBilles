export type Emotion =
  | 'idle'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'angry'
  | 'sleepy'
  | 'love'
  | 'scared';

export type TabView = 'play' | 'collection' | 'shop';

export type GameStatus = 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type SkinId = 'classic' | 'pastel' | 'candy' | 'starry' | 'watercolor';
export type AccessoryId = 'none' | 'crown' | 'glasses' | 'blush' | 'stars';
export type ThemeId = 'wood' | 'sakura' | 'night' | 'ocean';
export type MergeEffectId = 'sparkles' | 'hearts' | 'cosmic' | 'confetti';

export interface BallDefinition {
  level: number; // 1 to 11
  name: string;
  title: string;
  personality: string;
  radius: number;
  points: number;
  coinReward: number;
  colorPrimary: string;
  colorSecondary: string;
  colorHighlight: string;
  cheekColor: string;
  defaultEmotion: Emotion;
  droppable: boolean;
  specialFeature?: 'sprout' | 'stem' | 'freckles' | 'ears' | 'halo' | 'cosmic';
}

export interface ShopItem {
  id: string;
  category: 'skin' | 'accessory' | 'theme' | 'effect';
  itemKey: SkinId | AccessoryId | ThemeId | MergeEffectId;
  name: string;
  description: string;
  price: number;
  previewColors: string[];
}

export interface PlayerSettings {
  sfxEnabled: boolean;
  sfxVolume: number; // 0 to 1
  musicEnabled: boolean;
  musicVolume: number; // 0 to 1
  reducedEffects: boolean;
  showTrajectory: boolean;
}

export interface PlayerStats {
  bestScore: number;
  totalScore: number;
  gamesPlayed: number;
  totalMerges: number;
  totalBallsDropped: number;
  highestLevelEver: number;
  maxComboEver: number;
  supernovas: number;
  mergesByLevel: Record<number, number>;
}

export interface EquippedCosmetics {
  skin: SkinId;
  accessory: AccessoryId;
  theme: ThemeId;
  effect: MergeEffectId;
}

export interface SaveData {
  version: number;
  lastSavedAt: string;
  coins: number;
  redeemedPromoCodes: string[];
  discoveredLevels: number[];
  ownedShopItems: string[];
  equipped: EquippedCosmetics;
  stats: PlayerStats;
  settings: PlayerSettings;
}

export interface GameSessionSummary {
  score: number;
  isNewRecord: boolean;
  mergesThisGame: number;
  maxComboThisGame: number;
  highestLevelThisGame: number;
  coinsEarned: number;
  newlyDiscovered: number[];
}
