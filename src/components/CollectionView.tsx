import React, { useState } from 'react';
import { BALL_LEVELS } from '../data/balls';
import { Emotion, EquippedCosmetics, PlayerStats } from '../types/game';
import { BallPortrait } from './BallPortrait';

interface CollectionViewProps {
  discoveredLevels: number[];
  equipped: EquippedCosmetics;
  stats: PlayerStats;
}

const EMOTIONS: { key: Emotion; label: string }[] = [
  { key: 'happy', label: 'Heureuse' },
  { key: 'love', label: 'Amoureuse' },
  { key: 'surprised', label: 'Surprise' },
  { key: 'angry', label: 'Énervée' },
  { key: 'sleepy', label: 'Endormie' },
  { key: 'sad', label: 'Triste' },
  { key: 'scared', label: 'Effrayée' },
];

export const CollectionView: React.FC<CollectionViewProps> = ({
  discoveredLevels,
  equipped,
  stats,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [previewEmotion, setPreviewEmotion] = useState<Emotion>('happy');

  const discoveredSet = new Set(discoveredLevels);
  const selectedBall = BALL_LEVELS.find((b) => b.level === selectedLevel) || BALL_LEVELS[0];
  const isSelectedDiscovered = discoveredSet.has(selectedBall.level);
  const mergeCount = stats.mergesByLevel[selectedBall.level] || 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Collection des PopBilles
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {discoveredLevels.length} / {BALL_LEVELS.length} personnages découverts · Cliquez sur une bille pour tester ses émotions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Grid of all 11 balls */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BALL_LEVELS.map((ball) => {
            const discovered = discoveredSet.has(ball.level);
            const isSelected = selectedLevel === ball.level;
            return (
              <button
                key={ball.level}
                type="button"
                onClick={() => {
                  setSelectedLevel(ball.level);
                  setPreviewEmotion(ball.defaultEmotion);
                }}
                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center ${
                  isSelected
                    ? 'bg-white border-amber-500 shadow-sm ring-2 ring-amber-200'
                    : 'bg-white border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="mb-2">
                  <BallPortrait
                    level={ball.level}
                    size={76}
                    skin={equipped.skin}
                    accessory={equipped.accessory}
                    isSilhouette={!discovered}
                  />
                </div>
                <div className="text-center w-full">
                  <div className="text-xs text-slate-500 font-mono-nums">
                    Niv. {ball.level} · {ball.points} pts
                  </div>
                  <div className="font-bold text-slate-900 text-sm truncate mt-0.5">
                    {discovered ? ball.name : 'À découvrir'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Character Inspector */}
        <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-6 sticky top-6">
          <div className="flex flex-col items-center text-center pb-5 border-b border-stone-100">
            <BallPortrait
              level={selectedBall.level}
              size={148}
              skin={equipped.skin}
              accessory={equipped.accessory}
              emotion={previewEmotion}
              isSilhouette={!isSelectedDiscovered}
            />

            <div className="mt-3 text-xs font-medium text-slate-500 font-mono-nums">
              Niveau {selectedBall.level} · Diamètre {selectedBall.radius * 2}px · {selectedBall.points} pts
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              {isSelectedDiscovered ? selectedBall.name : 'Personnage Mystère'}
            </h2>
            <p className="text-sm font-medium text-amber-700 mt-0.5">
              {isSelectedDiscovered
                ? selectedBall.title
                : `Fusionnez deux boules de niveau ${selectedBall.level - 1} pour la révéler`}
            </p>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              {isSelectedDiscovered
                ? selectedBall.personality
                : 'Ce personnage attend encore d’apparaître dans votre bocal. Continuez vos fusions pour le débloquer !'}
            </p>
          </div>

          {isSelectedDiscovered && (
            <div className="pt-5">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2.5">
                <span className="font-semibold text-slate-700">Tester ses expressions</span>
                <span className="font-mono-nums">{mergeCount} fusions réalisées</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS.map((em) => (
                  <button
                    key={em.key}
                    type="button"
                    onClick={() => setPreviewEmotion(em.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      previewEmotion === em.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                    }`}
                  >
                    {em.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
