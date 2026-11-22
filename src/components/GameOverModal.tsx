import React from 'react';
import { Coins, RotateCcw, Trophy } from 'lucide-react';
import { getBallByLevel } from '../data/balls';
import { EquippedCosmetics, GameSessionSummary } from '../types/game';
import { BallPortrait } from './BallPortrait';

interface GameOverModalProps {
  summary: GameSessionSummary | null;
  bestScore: number;
  equipped: EquippedCosmetics;
  onReplay: () => void;
  onGoToCollection: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  summary,
  bestScore,
  equipped,
  onReplay,
  onGoToCollection,
}) => {
  if (!summary) return null;

  const bestBall = getBallByLevel(summary.highestLevelThisGame);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Fin de partie"
    >
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-md p-6 shadow-xl text-center">
        {summary.isNewRecord && (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Nouveau record personnel !
          </div>
        )}

        <h2 className="text-2xl font-bold text-slate-900">Partie terminée</h2>
        <p className="text-sm text-slate-500 mt-1">
          Le bocal a débordé, mais vos PopBilles ont brillé !
        </p>

        <div className="my-5 py-4 px-5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-around">
          <div>
            <div className="text-xs text-slate-500">Score final</div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono-nums">
              {summary.score.toLocaleString('fr-FR')}
            </div>
          </div>
          <div className="h-10 w-px bg-stone-200" />
          <div>
            <div className="text-xs text-slate-500">Record</div>
            <div className="text-xl font-bold text-slate-700 font-mono-nums">
              {Math.max(bestScore, summary.score).toLocaleString('fr-FR')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mb-5">
          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
            <div className="text-xs text-slate-500">Fusions</div>
            <div className="text-base font-bold font-mono-nums text-slate-900">
              {summary.mergesThisGame}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
            <div className="text-xs text-slate-500">Max Combo</div>
            <div className="text-base font-bold font-mono-nums text-slate-900">
              x{Math.max(1, summary.maxComboThisGame)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <div className="text-xs text-amber-700">Éclats (score)</div>
            <div className="text-base font-bold font-mono-nums text-amber-900 inline-flex items-center gap-1">
              <Coins className="w-3.5 h-3.5" />+{summary.coinsEarned}
            </div>
          </div>
        </div>

        {/* Highest ball reached */}
        <div className="flex items-center justify-center gap-3 mb-5 text-left px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-100">
          <BallPortrait
            level={bestBall.level}
            size={48}
            skin={equipped.skin}
            accessory={equipped.accessory}
            emotion="happy"
          />
          <div>
            <div className="text-xs text-slate-500">Plus grosse boule créée</div>
            <div className="text-sm font-bold text-slate-900">
              {bestBall.name} (Niv. {bestBall.level})
            </div>
          </div>
        </div>

        {summary.newlyDiscovered.length > 0 && (
          <div className="mb-5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            {summary.newlyDiscovered.length} nouveau(x) personnage(s) débloqué(s) dans votre Collection !
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onReplay}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Rejouer
          </button>
          <button
            type="button"
            onClick={onGoToCollection}
            className="flex-1 py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-800 font-semibold text-sm transition-colors cursor-pointer"
          >
            Voir la Collection
          </button>
        </div>
      </div>
    </div>
  );
};
