import React, { useEffect, useRef } from 'react';
import { getBallByLevel } from '../data/balls';
import { drawBallCharacter } from '../rendering/ballRenderer';
import { AccessoryId, Emotion, SkinId } from '../types/game';

interface BallPortraitProps {
  level: number;
  size: number;
  skin?: SkinId;
  accessory?: AccessoryId;
  emotion?: Emotion;
  isSilhouette?: boolean;
  className?: string;
}

export const BallPortrait: React.FC<BallPortraitProps> = ({
  level,
  size,
  skin = 'classic',
  accessory = 'none',
  emotion,
  isSilhouette = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const def = getBallByLevel(level);
    const drawRadius = size * 0.36;

    drawBallCharacter(
      ctx,
      {
        level,
        x: size / 2,
        y: size / 2 + size * 0.03,
        radius: drawRadius,
        angle: 0,
        scaleX: 1,
        scaleY: 1,
        emotion: emotion || def.defaultEmotion,
        blinkAmount: 0,
        lookX: 0,
        lookY: 0,
        ageSec: 0.4,
      },
      skin,
      accessory,
      isSilhouette
    );

    ctx.restore();
  }, [level, size, skin, accessory, emotion, isSilhouette]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={`block shrink-0 ${className}`}
      aria-label={isSilhouette ? 'Boule à découvrir' : getBallByLevel(level).name}
    />
  );
};
