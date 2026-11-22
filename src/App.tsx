import React, { useCallback, useEffect, useState } from 'react';
import { Coins, Settings } from 'lucide-react';
import { BallPortrait } from './components/BallPortrait';
import { CollectionView } from './components/CollectionView';
import { GameBoard } from './components/GameBoard';
import { GameOverModal } from './components/GameOverModal';
import { SettingsModal } from './components/SettingsModal';
import { ShopView } from './components/ShopView';
import { BALL_LEVELS, getBallByLevel } from './data/balls';
import { PROMO_CODES } from './data/catalog';
import {
  AccessoryId,
  GameSessionSummary,
  GameStatus,
  MergeEffectId,
  PlayerSettings,
  SaveData,
  ShopItem,
  SkinId,
  TabView,
  ThemeId,
} from './types/game';
import { soundEngine } from './utils/audio';
import {
  clearAllSaveData,
  importSaveDataJson,
  loadSaveData,
  persistSaveData,
  restoreFromIndexedDBIfNeeded,
} from './utils/storage';

function randomDroppableLevel(): number {
  const weights = [0.3, 0.28, 0.22, 0.13, 0.07];
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r <= acc) return i + 1;
  }
  return 1;
}

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [activeTab, setActiveTab] = useState<TabView>('play');
  const [gameStatus, setGameStatus] = useState<GameStatus>('PLAYING');
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [highestInGame, setHighestInGame] = useState<number>(5);
  const [restartNonce, setRestartNonce] = useState<number>(0);
  const [queue, setQueue] = useState<{ current: number; next: number }>(() => ({
    current: randomDroppableLevel(),
    next: randomDroppableLevel(),
  }));
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [gameOverSummary, setGameOverSummary] = useState<GameSessionSummary | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Restore from IndexedDB backup if localStorage was cleared externally
  useEffect(() => {
    const raw = localStorage.getItem('popbilles_save_v1');
    if (!raw) {
      void restoreFromIndexedDBIfNeeded().then((restored) => {
        if (restored) {
          setSave(restored);
        }
      });
    }
  }, []);

  // Sync audio engine with saved settings
  useEffect(() => {
    soundEngine.updateSettings(save.settings);
  }, [save.settings]);

  // Auto-save whenever save state changes
  useEffect(() => {
    const res = persistSaveData(save);
    if (!res.ok && res.error) {
      setToastMsg(res.error);
    }
  }, [save]);

  // Auto-dismiss transient toast notifications
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const handleTabChange = (tab: TabView) => {
    soundEngine.playClick();
    if (tab !== 'play' && gameStatus === 'PLAYING' && currentScore > 0) {
      setGameStatus('PAUSED');
    }
    setActiveTab(tab);
  };

  const handleQueueAdvance = useCallback((newCurrent: number, newNext: number) => {
    setQueue({ current: newCurrent, next: newNext });
  }, []);

  const handleScoreChange = useCallback((score: number) => {
    setCurrentScore(score);
    setSave((prev) => {
      if (score <= prev.stats.bestScore) return prev;
      return {
        ...prev,
        stats: {
          ...prev.stats,
          bestScore: score,
        },
      };
    });
  }, []);

  const handleBallDropped = useCallback(() => {
    setSave((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        totalBallsDropped: prev.stats.totalBallsDropped + 1,
      },
    }));
  }, []);

  const handleMergeEvent = useCallback(
    (payload: {
      newLevel: number;
      pointsGained: number;
      coinsGained: number;
      combo: number;
      isSupernova: boolean;
      isNewDiscovery: boolean;
    }) => {
      setHighestInGame((h) => Math.max(h, payload.newLevel));

      if (payload.isNewDiscovery) {
        const def = getBallByLevel(payload.newLevel);
        setToastMsg(`Nouveau personnage découvert : ${def.name} !`);
      }

      setSave((prev) => {
        const discovered = prev.discoveredLevels.includes(payload.newLevel)
          ? prev.discoveredLevels
          : [...prev.discoveredLevels, payload.newLevel].sort((a, b) => a - b);

        const prevLevelMerges = prev.stats.mergesByLevel[payload.newLevel] || 0;

        return {
          ...prev,
          discoveredLevels: discovered,
          stats: {
            ...prev.stats,
            totalMerges: prev.stats.totalMerges + 1,
            highestLevelEver: Math.max(prev.stats.highestLevelEver, payload.newLevel),
            maxComboEver: Math.max(prev.stats.maxComboEver, payload.combo),
            supernovas: prev.stats.supernovas + (payload.isSupernova ? 1 : 0),
            mergesByLevel: {
              ...prev.stats.mergesByLevel,
              [payload.newLevel]: prevLevelMerges + 1,
            },
          },
        };
      });
    },
    []
  );

  const handleGameOver = useCallback((summary: GameSessionSummary) => {
    setGameStatus('GAME_OVER');
    setGameOverSummary(summary);
    if (summary.coinsEarned > 0) {
      soundEngine.playCoin();
    }

    setSave((prev) => ({
      ...prev,
      coins: prev.coins + summary.coinsEarned,
      stats: {
        ...prev.stats,
        gamesPlayed: prev.stats.gamesPlayed + 1,
        totalScore: prev.stats.totalScore + summary.score,
        bestScore: Math.max(prev.stats.bestScore, summary.score),
      },
    }));
  }, []);

  const handleRestart = useCallback(() => {
    soundEngine.playClick();
    setGameOverSummary(null);
    setCurrentScore(0);
    setHighestInGame(5);
    setQueue({
      current: randomDroppableLevel(),
      next: randomDroppableLevel(),
    });
    setRestartNonce((n) => n + 1);
    setGameStatus('PLAYING');
  }, []);

  const handlePauseToggle = useCallback(() => {
    soundEngine.playClick();
    setGameStatus((prev) => (prev === 'PLAYING' ? 'PAUSED' : prev === 'PAUSED' ? 'PLAYING' : prev));
  }, []);

  const handleBuyAndEquip = (item: ShopItem) => {
    soundEngine.playCoin();
    setSave((prev) => {
      if (prev.coins < item.price || prev.ownedShopItems.includes(item.id)) return prev;
      const nextEquipped = { ...prev.equipped };
      if (item.category === 'skin') nextEquipped.skin = item.itemKey as SkinId;
      if (item.category === 'accessory') nextEquipped.accessory = item.itemKey as AccessoryId;
      if (item.category === 'theme') nextEquipped.theme = item.itemKey as ThemeId;
      if (item.category === 'effect') nextEquipped.effect = item.itemKey as MergeEffectId;

      return {
        ...prev,
        coins: prev.coins - item.price,
        ownedShopItems: [...prev.ownedShopItems, item.id],
        equipped: nextEquipped,
      };
    });
    setToastMsg(`${item.name} débloqué et équipé !`);
  };

  const handleEquip = (item: ShopItem) => {
    soundEngine.playClick();
    setSave((prev) => {
      const nextEquipped = { ...prev.equipped };
      if (item.category === 'skin') nextEquipped.skin = item.itemKey as SkinId;
      if (item.category === 'accessory') nextEquipped.accessory = item.itemKey as AccessoryId;
      if (item.category === 'theme') nextEquipped.theme = item.itemKey as ThemeId;
      if (item.category === 'effect') nextEquipped.effect = item.itemKey as MergeEffectId;
      return { ...prev, equipped: nextEquipped };
    });
  };

  const handleRedeemPromoCode = (rawCode: string): { ok: boolean; message: string } => {
    const code = rawCode.trim().toUpperCase();
    const reward = PROMO_CODES[code];
    if (!reward) {
      return { ok: false, message: 'Code promo invalide ou expiré.' };
    }
    if (save.redeemedPromoCodes.includes(code)) {
      return { ok: false, message: 'Ce code promo a déjà été utilisé sur cette sauvegarde.' };
    }

    soundEngine.playCoin();
    setSave((prev) => ({
      ...prev,
      coins: prev.coins + reward,
      redeemedPromoCodes: [...prev.redeemedPromoCodes, code],
    }));
    setToastMsg(`Code validé : +${reward} éclats ajoutés !`);
    return {
      ok: true,
      message: `Code validé ! +${reward} éclats ont été ajoutés à votre solde.`,
    };
  };

  const handleUpdateSettings = (next: PlayerSettings) => {
    setSave((prev) => ({ ...prev, settings: next }));
  };

  const handleImportSave = (json: string): { ok: boolean; error?: string } => {
    const res = importSaveDataJson(json);
    if (res.ok) {
      setSave(res.data);
      return { ok: true };
    }
    return { ok: false, error: res.error };
  };

  const handleResetAllData = () => {
    void clearAllSaveData().then((fresh) => {
      setSave(fresh);
      handleRestart();
    });
  };

  const nextBallDef = getBallByLevel(queue.next);
  const currentBallDef = getBallByLevel(queue.current);

  const navItems: { key: TabView; label: string }[] = [
    { key: 'play', label: 'Jouer' },
    { key: 'collection', label: 'Collection' },
    { key: 'shop', label: 'Boutique' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f4ef] text-slate-900">
      {/* Three-Zone Top Bar */}
      <header className="bg-white/90 backdrop-blur-xs border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Creator logo + Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleTabChange('play')}
            className="flex items-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/image_3aebf9e0.png`}
              alt="Game Center"
              referrerPolicy="no-referrer"
              className="h-8 sm:h-9 w-auto object-contain shrink-0"
            />
            <span className="h-5 w-px bg-stone-200 shrink-0" aria-hidden="true" />
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              PopBilles
            </span>
          </button>

          {/* Zone 2: Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleTabChange(item.key)}
                className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  activeTab === item.key
                    ? 'border-amber-500 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Coins & Primary Settings Action */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-1.5 text-sm font-bold font-mono-nums text-amber-800 whitespace-nowrap">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>{save.coins}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setSettingsOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              Paramètres
            </button>
          </div>
        </div>

        {/* Mobile Compact Nav Row */}
        <nav className="md:hidden flex items-center justify-around border-t border-stone-100 px-2 py-1.5">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleTabChange(item.key)}
              className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 rounded-lg transition-colors cursor-pointer ${
                activeTab === item.key ? 'bg-amber-50 text-amber-800' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'play' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 lg:py-10">
            {/* Mobile Compact Score & Next Strip */}
            <div className="grid grid-cols-3 gap-3 mb-5 lg:hidden">
              <div className="bg-white border border-stone-200 rounded-2xl p-3">
                <div className="text-[11px] text-slate-500 font-medium">Score</div>
                <div className="text-lg font-extrabold font-mono-nums text-slate-900">
                  {currentScore.toLocaleString('fr-FR')}
                </div>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-3">
                <div className="text-[11px] text-slate-500 font-medium">Record</div>
                <div className="text-lg font-bold font-mono-nums text-amber-700">
                  {Math.max(save.stats.bestScore, currentScore).toLocaleString('fr-FR')}
                </div>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl px-3 py-2 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Suivante</div>
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[65px]">
                    {nextBallDef.name}
                  </div>
                </div>
                <BallPortrait
                  level={nextBallDef.level}
                  size={36}
                  skin={save.equipped.skin}
                  accessory={save.equipped.accessory}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
              {/* Left Panel (Desktop): Airy Score & Next Ball */}
              <aside className="hidden lg:flex lg:col-span-3 flex-col gap-6 pt-2">
                <div className="bg-white border border-stone-200 rounded-2xl p-6">
                  <div className="text-xs font-semibold text-slate-500">Score actuel</div>
                  <div className="text-4xl font-extrabold font-mono-nums text-slate-900 mt-1.5">
                    {currentScore.toLocaleString('fr-FR')}
                  </div>

                  <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Meilleur score</span>
                    <span className="text-base font-bold font-mono-nums text-amber-700">
                      {Math.max(save.stats.bestScore, currentScore).toLocaleString('fr-FR')}
                    </span>
                  </div>
                </div>

                {/* Current & Next Ball Preview */}
                <div className="bg-white border border-stone-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-slate-500">Prochaine bille</span>
                    <span className="text-xs font-mono-nums text-slate-500">
                      Niv. {nextBallDef.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <BallPortrait
                      level={nextBallDef.level}
                      size={72}
                      skin={save.equipped.skin}
                      accessory={save.equipped.accessory}
                    />
                    <div>
                      <div className="text-base font-bold text-slate-900">{nextBallDef.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{nextBallDef.title}</div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-slate-500">
                    <span>En main</span>
                    <span className="font-semibold text-slate-800">
                      {currentBallDef.name} · Niv. {currentBallDef.level}
                    </span>
                  </div>
                </div>
              </aside>

              {/* Center Column: Spacious Physics Jar */}
              <section className="lg:col-span-6 flex flex-col items-center">
                <GameBoard
                  status={gameStatus}
                  bestScore={save.stats.bestScore}
                  discoveredLevels={save.discoveredLevels}
                  equipped={save.equipped}
                  settings={save.settings}
                  currentLevelQueue={queue}
                  onQueueAdvance={handleQueueAdvance}
                  onScoreChange={handleScoreChange}
                  onMergeEvent={handleMergeEvent}
                  onBallDropped={handleBallDropped}
                  onPauseToggle={handlePauseToggle}
                  onRestartRequest={handleRestart}
                  onGameOver={handleGameOver}
                  restartNonce={restartNonce}
                />
              </section>

              {/* Right Panel: Airy Evolution Ladder */}
              <aside className="lg:col-span-3 pt-2">
                <div className="bg-white border border-stone-200 rounded-2xl p-6">
                  <div className="flex items-baseline justify-between mb-2">
                    <h2 className="text-sm font-bold text-slate-900">Évolution des billes</h2>
                    <span className="text-xs text-slate-500 font-mono-nums">
                      {save.discoveredLevels.length}/11
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Fusionnez deux billes identiques pour créer le niveau suivant.
                  </p>

                  <div className="divide-y divide-stone-100">
                    {BALL_LEVELS.map((ball) => {
                      const discovered = save.discoveredLevels.includes(ball.level);
                      const reachedNow = highestInGame >= ball.level && currentScore > 0;
                      return (
                        <div
                          key={ball.level}
                          className={`flex items-center justify-between py-2 px-2 rounded-lg transition-colors ${
                            reachedNow ? 'bg-amber-50/70' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <BallPortrait
                              level={ball.level}
                              size={30}
                              skin={save.equipped.skin}
                              accessory={save.equipped.accessory}
                              isSilhouette={!discovered}
                            />
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {discovered ? ball.name : '???'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono-nums shrink-0 ml-2">
                            Niv. {ball.level} · {ball.points} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {activeTab === 'collection' && (
          <CollectionView
            discoveredLevels={save.discoveredLevels}
            equipped={save.equipped}
            stats={save.stats}
          />
        )}

        {activeTab === 'shop' && (
          <ShopView
            coins={save.coins}
            ownedItems={save.ownedShopItems}
            equipped={save.equipped}
            onBuyAndEquip={handleBuyAndEquip}
            onEquip={handleEquip}
            onRedeemPromoCode={handleRedeemPromoCode}
          />
        )}
      </main>

      {/* Transient Toast Banner */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-lg pointer-events-none"
        >
          {toastMsg}
        </div>
      )}

      {/* Modals */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={save.settings}
        saveData={save}
        onUpdateSettings={handleUpdateSettings}
        onImportSave={handleImportSave}
        onResetAllData={handleResetAllData}
      />

      <GameOverModal
        summary={gameOverSummary}
        bestScore={save.stats.bestScore}
        equipped={save.equipped}
        onReplay={handleRestart}
        onGoToCollection={() => {
          setGameOverSummary(null);
          handleRestart();
          setActiveTab('collection');
        }}
      />
    </div>
  );
}
