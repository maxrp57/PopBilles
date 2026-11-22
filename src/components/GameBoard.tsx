import React, { useCallback, useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { BALL_LEVELS, BOARD_THEMES, getBallByLevel } from '../data/balls';
import {
  drawBallCharacter,
  FloatingPopup,
  Particle,
  Shockwave,
  spawnMergeParticles,
} from '../rendering/ballRenderer';
import {
  EquippedCosmetics,
  Emotion,
  GameSessionSummary,
  GameStatus,
  PlayerSettings,
} from '../types/game';
import { soundEngine } from '../utils/audio';

export const ARENA_W = 400;
export const ARENA_H = 560;
const WALL_THICKNESS = 24;
const JAR_LEFT = 20;
const JAR_RIGHT = ARENA_W - 20;
const JAR_FLOOR = ARENA_H - 18;
const JAR_RIM_Y = 86;
const DANGER_Y = 108;
const DROP_Y = 42;
const DANGER_LIMIT_SEC = 2.8;
const DROP_COOLDOWN_MS = 460;

interface BallRuntimeMeta {
  bodyId: number;
  level: number;
  emotion: Emotion;
  emotionTimer: number;
  blinkTimer: number;
  blinkState: number;
  scaleX: number;
  scaleY: number;
  createdAt: number;
  stillTime: number;
  ageSec: number;
  merging: boolean;
}

interface GameBoardProps {
  status: GameStatus;
  bestScore: number;
  discoveredLevels: number[];
  equipped: EquippedCosmetics;
  settings: PlayerSettings;
  currentLevelQueue: { current: number; next: number };
  onQueueAdvance: (newCurrent: number, newNext: number) => void;
  onScoreChange: (score: number) => void;
  onMergeEvent: (payload: {
    newLevel: number;
    pointsGained: number;
    coinsGained: number;
    combo: number;
    isSupernova: boolean;
    isNewDiscovery: boolean;
  }) => void;
  onBallDropped: () => void;
  onPauseToggle: () => void;
  onRestartRequest: () => void;
  onGameOver: (summary: GameSessionSummary) => void;
  restartNonce: number;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  status,
  bestScore,
  discoveredLevels,
  equipped,
  settings,
  currentLevelQueue,
  onQueueAdvance,
  onScoreChange,
  onMergeEvent,
  onBallDropped,
  onPauseToggle,
  onRestartRequest,
  onGameOver,
  restartNonce,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<GameStatus>(status);
  const equippedRef = useRef<EquippedCosmetics>(equipped);
  const settingsRef = useRef<PlayerSettings>(settings);
  const bestScoreRef = useRef<number>(bestScore);
  const initialBestScoreRef = useRef<number>(bestScore);
  const discoveredRef = useRef<Set<number>>(new Set(discoveredLevels));
  const queueRef = useRef(currentLevelQueue);

  // Sync refs for smooth 60fps animation loop without recreating Matter engine
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    equippedRef.current = equipped;
  }, [equipped]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    bestScoreRef.current = bestScore;
  }, [bestScore]);

  useEffect(() => {
    discoveredRef.current = new Set(discoveredLevels);
  }, [discoveredLevels]);

  useEffect(() => {
    queueRef.current = currentLevelQueue;
  }, [currentLevelQueue]);

  // Physics & animation mutable state refs
  const engineRef = useRef<Matter.Engine | null>(null);
  const metaMapRef = useRef<Map<number, BallRuntimeMeta>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const popupsRef = useRef<FloatingPopup[]>([]);
  const aimXRef = useRef<number>(ARENA_W / 2);
  const lastDropAtRef = useRef<number>(0);
  const dangerTimerRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);

  // Per-session gameplay tracking
  const sessionRef = useRef({
    score: 0,
    merges: 0,
    maxCombo: 0,
    highestLevel: 5,
    newlyDiscovered: new Set<number>(),
    recordBrokenSoundPlayed: false,
    comboCount: 0,
    lastMergeAt: 0,
    gameOverTriggered: false,
  });

  const [dangerRatio, setDangerRatio] = useState(0);

  // Reset physics world cleanly when restartNonce changes
  const initPhysicsWorld = useCallback(() => {
    if (engineRef.current) {
      Matter.World.clear(engineRef.current.world, false);
      Matter.Engine.clear(engineRef.current);
    }

    const engine = Matter.Engine.create({
      positionIterations: 10,
      velocityIterations: 8,
    });
    engine.gravity.y = 1.18;

    const wallOpts: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      restitution: 0.25,
      friction: 0.2,
      label: 'wall',
    };

    const leftWall = Matter.Bodies.rectangle(
      JAR_LEFT - WALL_THICKNESS / 2,
      ARENA_H / 2 + 20,
      WALL_THICKNESS,
      ARENA_H,
      wallOpts
    );
    const rightWall = Matter.Bodies.rectangle(
      JAR_RIGHT + WALL_THICKNESS / 2,
      ARENA_H / 2 + 20,
      WALL_THICKNESS,
      ARENA_H,
      wallOpts
    );
    const floor = Matter.Bodies.rectangle(
      ARENA_W / 2,
      JAR_FLOOR + WALL_THICKNESS / 2,
      ARENA_W,
      WALL_THICKNESS,
      wallOpts
    );

    Matter.World.add(engine.world, [leftWall, rightWall, floor]);

    metaMapRef.current.clear();
    particlesRef.current = [];
    shockwavesRef.current = [];
    popupsRef.current = [];
    aimXRef.current = ARENA_W / 2;
    lastDropAtRef.current = 0;
    dangerTimerRef.current = 0;
    shakeRef.current = 0;
    initialBestScoreRef.current = bestScoreRef.current;
    setDangerRatio(0);

    sessionRef.current = {
      score: 0,
      merges: 0,
      maxCombo: 0,
      highestLevel: 5,
      newlyDiscovered: new Set<number>(),
      recordBrokenSoundPlayed: false,
      comboCount: 0,
      lastMergeAt: 0,
      gameOverTriggered: false,
    };

    const handleCollisionPair = (bodyA: Matter.Body, bodyB: Matter.Body) => {
      if (statusRef.current !== 'PLAYING') return;

      const metaA = metaMapRef.current.get(bodyA.id);
      const metaB = metaMapRef.current.get(bodyB.id);

      // Squash & bounce feedback on normal collisions
      const relVx = bodyA.velocity.x - bodyB.velocity.x;
      const relVy = bodyA.velocity.y - bodyB.velocity.y;
      const impact = Math.hypot(relVx, relVy);

      if (impact > 2.2) {
        soundEngine.playBounce(impact / 10);
        if (metaA && !metaA.merging) {
          metaA.scaleX = Math.min(1.22, 1 + impact * 0.02);
          metaA.scaleY = Math.max(0.8, 1 - impact * 0.02);
          if (impact > 6.5 && metaA.emotionTimer <= 0) {
            metaA.emotion = Math.random() > 0.5 ? 'angry' : 'surprised';
            metaA.emotionTimer = 0.7;
          } else if (metaB && metaB.level >= metaA.level + 3 && metaA.emotionTimer <= 0) {
            metaA.emotion = 'sad';
            metaA.emotionTimer = 0.9;
          }
        }
        if (metaB && !metaB.merging) {
          metaB.scaleX = Math.min(1.22, 1 + impact * 0.02);
          metaB.scaleY = Math.max(0.8, 1 - impact * 0.02);
          if (impact > 6.5 && metaB.emotionTimer <= 0) {
            metaB.emotion = Math.random() > 0.5 ? 'angry' : 'surprised';
            metaB.emotionTimer = 0.7;
          } else if (metaA && metaA.level >= metaB.level + 3 && metaB.emotionTimer <= 0) {
            metaB.emotion = 'sad';
            metaB.emotionTimer = 0.9;
          }
        }
      } else if (impact > 0.8 && metaA && metaB && !metaA.merging && !metaB.merging) {
        if (metaA.emotionTimer <= 0 && Math.random() < 0.25) {
          metaA.emotion = 'happy';
          metaA.emotionTimer = 0.6;
        }
        if (metaB.emotionTimer <= 0 && Math.random() < 0.25) {
          metaB.emotion = 'happy';
          metaB.emotionTimer = 0.6;
        }
      }

      // Check merge eligibility
      if (!metaA || !metaB) return;
      if (metaA.merging || metaB.merging) return;
      if (metaA.level !== metaB.level) return;

      // Guard against duplicate triggers
      metaA.merging = true;
      metaB.merging = true;

      const midX = (bodyA.position.x + bodyB.position.x) / 2;
      const midY = (bodyA.position.y + bodyB.position.y) / 2;

      Matter.World.remove(engine.world, [bodyA, bodyB]);
      metaMapRef.current.delete(bodyA.id);
      metaMapRef.current.delete(bodyB.id);

      const now = performance.now();
      const s = sessionRef.current;
      if (now - s.lastMergeAt < 1450) {
        s.comboCount += 1;
      } else {
        s.comboCount = 1;
      }
      s.lastMergeAt = now;
      s.merges += 1;
      if (s.comboCount > s.maxCombo) s.maxCombo = s.comboCount;

      const comboMult = 1 + Math.min(s.comboCount - 1, 6) * 0.25;
      const isSupernova = metaA.level >= BALL_LEVELS.length;

      if (isSupernova) {
        // Two Level 11 Celestes fuse into a Supernova burst!
        const pts = Math.round(3000 * comboMult);
        s.score += pts;
        s.highestLevel = Math.max(s.highestLevel, 11);

        soundEngine.playSupernova();
        if (!settingsRef.current.reducedEffects) {
          shakeRef.current = 12;
          spawnMergeParticles(
            particlesRef.current,
            shockwavesRef.current,
            midX,
            midY,
            11,
            'cosmic',
            equippedRef.current.skin
          );
        }
        popupsRef.current.push({
          x: midX,
          y: midY - 10,
          vy: -1.1,
          text: `SUPERNOVA ! +${pts}`,
          color: '#EC4899',
          life: 0,
          maxLife: 1.5,
          scale: 1.25,
        });

        onScoreChange(s.score);
        onMergeEvent({
          newLevel: 11,
          pointsGained: pts,
          coinsGained: 0,
          combo: s.comboCount,
          isSupernova: true,
          isNewDiscovery: false,
        });
        return;
      }

      const nextLevel = metaA.level + 1;
      const nextDef = getBallByLevel(nextLevel);

      // Clamp spawned ball inside jar walls
      const clampedX = Math.max(
        JAR_LEFT + nextDef.radius + 2,
        Math.min(JAR_RIGHT - nextDef.radius - 2, midX)
      );
      const clampedY = Math.min(JAR_FLOOR - nextDef.radius - 2, midY);

      const mergedBody = Matter.Bodies.circle(clampedX, clampedY, nextDef.radius, {
        restitution: 0.24,
        friction: 0.14,
        frictionAir: 0.008,
        density: 0.0018,
        label: `ball_${nextLevel}`,
      });

      Matter.Body.setVelocity(mergedBody, {
        x: (bodyA.velocity.x + bodyB.velocity.x) * 0.25,
        y: -1.4,
      });

      Matter.World.add(engine.world, mergedBody);

      metaMapRef.current.set(mergedBody.id, {
        bodyId: mergedBody.id,
        level: nextLevel,
        emotion: nextLevel === 4 || nextLevel === 11 ? 'love' : 'happy',
        emotionTimer: 1.8,
        blinkTimer: 2 + Math.random() * 3,
        blinkState: 0,
        scaleX: 0.45,
        scaleY: 0.45,
        createdAt: now,
        stillTime: 0,
        ageSec: 0,
        merging: false,
      });

      const pts = Math.round(nextDef.points * comboMult);
      s.score += pts;
      if (nextLevel > s.highestLevel) s.highestLevel = nextLevel;

      const isNewDiscovery = !discoveredRef.current.has(nextLevel);
      if (isNewDiscovery) {
        discoveredRef.current.add(nextLevel);
        s.newlyDiscovered.add(nextLevel);
        soundEngine.playNewDiscovery();
      } else {
        soundEngine.playMerge(nextLevel, s.comboCount);
      }

      if (
        initialBestScoreRef.current > 0 &&
        s.score > initialBestScoreRef.current &&
        !s.recordBrokenSoundPlayed
      ) {
        s.recordBrokenSoundPlayed = true;
        soundEngine.playNewRecord();
        popupsRef.current.push({
          x: ARENA_W / 2,
          y: 150,
          vy: -0.7,
          text: 'NOUVEAU RECORD !',
          color: '#D97706',
          life: 0,
          maxLife: 1.5,
          scale: 1.15,
        });
      }

      if (!settingsRef.current.reducedEffects) {
        if (nextLevel >= 7 || s.comboCount >= 3) {
          shakeRef.current = Math.min(8, 2 + s.comboCount * 1.2);
        }
        spawnMergeParticles(
          particlesRef.current,
          shockwavesRef.current,
          clampedX,
          clampedY,
          nextLevel,
          equippedRef.current.effect,
          equippedRef.current.skin
        );
      }

      popupsRef.current.push({
        x: clampedX,
        y: clampedY - nextDef.radius * 0.4,
        vy: -0.95,
        text: `+${pts}`,
        subtext:
          s.comboCount >= 2
            ? `Combo x${s.comboCount} !`
            : isNewDiscovery
              ? `Nouveau : ${nextDef.name} !`
              : undefined,
        color: s.comboCount >= 2 ? '#EA580C' : '#0F172A',
        life: 0,
        maxLife: s.comboCount >= 2 || isNewDiscovery ? 1.25 : 0.85,
        scale: s.comboCount >= 2 ? 1.12 : 1,
      });

      onScoreChange(s.score);
      onMergeEvent({
        newLevel: nextLevel,
        pointsGained: pts,
        coinsGained: 0,
        combo: s.comboCount,
        isSupernova: false,
        isNewDiscovery,
      });
    };

    Matter.Events.on(engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        handleCollisionPair(pair.bodyA, pair.bodyB);
      }
    });

    Matter.Events.on(engine, 'collisionActive', (event) => {
      for (const pair of event.pairs) {
        const metaA = metaMapRef.current.get(pair.bodyA.id);
        const metaB = metaMapRef.current.get(pair.bodyB.id);
        if (
          metaA &&
          metaB &&
          !metaA.merging &&
          !metaB.merging &&
          metaA.level === metaB.level
        ) {
          handleCollisionPair(pair.bodyA, pair.bodyB);
        }
      }
    });

    engineRef.current = engine;
  }, [onMergeEvent, onScoreChange]);

  useEffect(() => {
    initPhysicsWorld();
    return () => {
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world, false);
        Matter.Engine.clear(engineRef.current);
      }
    };
  }, [restartNonce, initPhysicsWorld]);

  // Drop ball action
  const dropBall = useCallback(
    (targetX?: number) => {
      if (statusRef.current !== 'PLAYING') return;
      const engine = engineRef.current;
      if (!engine) return;

      const now = performance.now();
      if (now - lastDropAtRef.current < DROP_COOLDOWN_MS) return;

      soundEngine.unlock();

      const dropLevel = queueRef.current.current;
      const def = getBallByLevel(dropLevel);
      const minX = JAR_LEFT + def.radius + 4;
      const maxX = JAR_RIGHT - def.radius - 4;
      const spawnX = Math.max(minX, Math.min(maxX, targetX ?? aimXRef.current));
      aimXRef.current = spawnX;

      const body = Matter.Bodies.circle(spawnX, DROP_Y, def.radius, {
        restitution: 0.24,
        friction: 0.14,
        frictionAir: 0.008,
        density: 0.0018,
        label: `ball_${dropLevel}`,
      });

      Matter.World.add(engine.world, body);
      metaMapRef.current.set(body.id, {
        bodyId: body.id,
        level: dropLevel,
        emotion: 'surprised',
        emotionTimer: 0.65,
        blinkTimer: 1.5 + Math.random() * 2.5,
        blinkState: 0,
        scaleX: 0.92,
        scaleY: 1.08,
        createdAt: now,
        stillTime: 0,
        ageSec: 0,
        merging: false,
      });

      lastDropAtRef.current = now;
      soundEngine.playDrop();
      onBallDropped();

      // Advance queue with weighted random droppable ball (levels 1-5)
      const weights = [0.28, 0.26, 0.22, 0.15, 0.09];
      const r = Math.random();
      let acc = 0;
      let nextSpawn = 1;
      for (let i = 0; i < weights.length; i++) {
        acc += weights[i];
        if (r <= acc) {
          nextSpawn = i + 1;
          break;
        }
      }
      onQueueAdvance(queueRef.current.next, nextSpawn);
    },
    [onBallDropped, onQueueAdvance]
  );

  // Main render + fixed-timestep physics loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const FIXED_STEP = 1000 / 60;

    const loop = (now: number) => {
      const elapsed = Math.min(50, now - lastTime);
      lastTime = now;
      const dtSec = elapsed / 1000;

      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (engine && statusRef.current === 'PLAYING') {
        accumulator += elapsed;
        let steps = 0;
        while (accumulator >= FIXED_STEP && steps < 3) {
          Matter.Engine.update(engine, FIXED_STEP);
          accumulator -= FIXED_STEP;
          steps++;
        }

        // Update living emotions, squash recovery, and danger line check
        let anyAboveDanger = false;
        const bodies = Matter.Composite.allBodies(engine.world);

        for (const body of bodies) {
          if (body.isStatic) continue;
          const meta = metaMapRef.current.get(body.id);
          if (!meta) continue;

          meta.ageSec += dtSec;

          // Recover squash & stretch smoothly
          meta.scaleX += (1 - meta.scaleX) * Math.min(1, dtSec * 14);
          meta.scaleY += (1 - meta.scaleY) * Math.min(1, dtSec * 14);

          // Blinking timer
          meta.blinkTimer -= dtSec;
          if (meta.blinkTimer <= 0) {
            meta.blinkState = 0.14;
            meta.blinkTimer = 2.4 + Math.random() * 3.5;
          }
          if (meta.blinkState > 0) {
            meta.blinkState = Math.max(0, meta.blinkState - dtSec);
          }

          const speed = Math.hypot(body.velocity.x, body.velocity.y);
          if (speed < 0.15) {
            meta.stillTime += dtSec;
          } else {
            meta.stillTime = 0;
          }

          if (meta.emotionTimer > 0) {
            meta.emotionTimer -= dtSec;
          } else {
            const def = getBallByLevel(meta.level);
            if (body.velocity.y > 4.6) {
              meta.emotion = 'surprised';
            } else if (dangerTimerRef.current > 0.6 && body.position.y < DANGER_Y + 65) {
              meta.emotion = 'scared';
            } else if (meta.stillTime > 5.5) {
              meta.emotion = 'sleepy';
            } else {
              meta.emotion = def.defaultEmotion;
            }
          }

          // Danger line overflow detection (skip freshly dropped balls for 1.4s)
          const def = getBallByLevel(meta.level);
          if (now - meta.createdAt > 1400 && body.position.y - def.radius < DANGER_Y) {
            anyAboveDanger = true;
          }
        }

        if (anyAboveDanger) {
          dangerTimerRef.current += dtSec;
          const ratio = Math.min(1, dangerTimerRef.current / DANGER_LIMIT_SEC);
          setDangerRatio(ratio);

          if (
            dangerTimerRef.current >= DANGER_LIMIT_SEC &&
            !sessionRef.current.gameOverTriggered
          ) {
            sessionRef.current.gameOverTriggered = true;
            soundEngine.playGameOver();
            const s = sessionRef.current;
            const endScoreCoins = s.score > 0 ? Math.max(2, Math.floor(s.score / 25)) : 0;
            onGameOver({
              score: s.score,
              isNewRecord: s.score > initialBestScoreRef.current && s.score > 0,
              mergesThisGame: s.merges,
              maxComboThisGame: s.maxCombo,
              highestLevelThisGame: s.highestLevel,
              coinsEarned: endScoreCoins,
              newlyDiscovered: Array.from(s.newlyDiscovered),
            });
          }
        } else if (dangerTimerRef.current > 0) {
          dangerTimerRef.current = Math.max(0, dangerTimerRef.current - dtSec * 2.2);
          setDangerRatio(Math.min(1, dangerTimerRef.current / DANGER_LIMIT_SEC));
        }
      }

      // Update particles, shockwaves, popups & screen shake
      if (shakeRef.current > 0) {
        shakeRef.current = Math.max(0, shakeRef.current - dtSec * 28);
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        p.life += dtSec;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.rotation += p.vRot;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        return p.life < p.maxLife;
      });

      shockwavesRef.current = shockwavesRef.current.filter((sw) => {
        sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dtSec * 9);
        sw.alpha -= dtSec * 2.1;
        return sw.alpha > 0.02;
      });

      popupsRef.current = popupsRef.current.filter((pop) => {
        pop.life += dtSec;
        pop.y += pop.vy;
        return pop.life < pop.maxLife;
      });

      // Render Frame
      if (canvas && engine) {
        const dpr = window.devicePixelRatio || 1;
        const expectedW = ARENA_W * dpr;
        const expectedH = ARENA_H * dpr;
        if (canvas.width !== expectedW || canvas.height !== expectedH) {
          canvas.width = expectedW;
          canvas.height = expectedH;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const theme = BOARD_THEMES[equippedRef.current.theme];
          ctx.save();
          ctx.scale(dpr, dpr);

          // Screen shake offset
          if (shakeRef.current > 0.2) {
            const sx = (Math.random() - 0.5) * shakeRef.current;
            const sy = (Math.random() - 0.5) * shakeRef.current;
            ctx.translate(sx, sy);
          }

          // Arena background gradient
          const bgGrad = ctx.createLinearGradient(0, 0, 0, ARENA_H);
          bgGrad.addColorStop(0, theme.boardBgTop);
          bgGrad.addColorStop(1, theme.boardBgBottom);
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, ARENA_W, ARENA_H);

          // Subtle background polka dots
          ctx.fillStyle = theme.accentDotColor;
          for (let gx = 44; gx < ARENA_W - 20; gx += 52) {
            for (let gy = 110; gy < ARENA_H - 30; gy += 52) {
              ctx.beginPath();
              ctx.arc(gx + ((gy / 52) % 2) * 20, gy, 3.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Jar back rim
          ctx.strokeStyle = theme.wallBorder;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(JAR_LEFT, JAR_RIM_Y);
          ctx.lineTo(JAR_RIGHT, JAR_RIM_Y);
          ctx.stroke();

          // Danger Limit Line
          ctx.save();
          const dangerActive = dangerTimerRef.current > 0.1;
          ctx.strokeStyle = dangerActive
            ? `rgba(239, 68, 68, ${0.55 + Math.sin(now * 0.015) * 0.35})`
            : 'rgba(239, 68, 68, 0.32)';
          ctx.lineWidth = dangerActive ? 2.5 : 1.5;
          ctx.setLineDash([7, 6]);
          ctx.beginPath();
          ctx.moveTo(JAR_LEFT + 4, DANGER_Y);
          ctx.lineTo(JAR_RIGHT - 4, DANGER_Y);
          ctx.stroke();
          ctx.restore();

          // Aiming trajectory + Next ball poised at top
          const canDropNow =
            statusRef.current === 'PLAYING' &&
            now - lastDropAtRef.current >= DROP_COOLDOWN_MS * 0.7;

          if (statusRef.current === 'PLAYING' || statusRef.current === 'PAUSED') {
            const currentDef = getBallByLevel(queueRef.current.current);
            const minX = JAR_LEFT + currentDef.radius + 4;
            const maxX = JAR_RIGHT - currentDef.radius - 4;
            const clampedAimX = Math.max(minX, Math.min(maxX, aimXRef.current));

            if (settingsRef.current.showTrajectory) {
              ctx.save();
              ctx.strokeStyle = theme.guideLineColor;
              ctx.lineWidth = 1.8;
              ctx.setLineDash([4, 6]);
              ctx.beginPath();
              ctx.moveTo(clampedAimX, DROP_Y + currentDef.radius + 4);
              ctx.lineTo(clampedAimX, JAR_FLOOR - 6);
              ctx.stroke();
              ctx.restore();
            }

            ctx.save();
            ctx.globalAlpha = canDropNow ? 1 : 0.45;
            drawBallCharacter(
              ctx,
              {
                level: currentDef.level,
                x: clampedAimX,
                y: DROP_Y,
                radius: currentDef.radius,
                angle: 0,
                scaleX: 1,
                scaleY: 1,
                emotion: currentDef.defaultEmotion,
                blinkAmount: 0,
                lookX: 0,
                lookY: 0.35,
                ageSec: now / 1000,
              },
              equippedRef.current.skin,
              equippedRef.current.accessory
            );
            ctx.restore();
          }

          // Render all physics balls
          const bodies = Matter.Composite.allBodies(engine.world);
          for (const body of bodies) {
            if (body.isStatic) continue;
            const meta = metaMapRef.current.get(body.id);
            if (!meta) continue;
            const def = getBallByLevel(meta.level);

            const speed = Math.hypot(body.velocity.x, body.velocity.y);
            const lookX = speed > 0.2 ? Math.max(-1, Math.min(1, body.velocity.x / 5)) : 0;
            const lookY = speed > 0.2 ? Math.max(-1, Math.min(1, body.velocity.y / 5)) : 0;

            drawBallCharacter(
              ctx,
              {
                level: meta.level,
                x: body.position.x,
                y: body.position.y,
                radius: def.radius,
                angle: body.angle,
                scaleX: meta.scaleX,
                scaleY: meta.scaleY,
                emotion: meta.emotion,
                blinkAmount: meta.blinkState > 0 ? 1 : 0,
                lookX,
                lookY,
                ageSec: meta.ageSec,
              },
              equippedRef.current.skin,
              equippedRef.current.accessory
            );
          }

          // Jar Walls & Floor foreground frame
          ctx.fillStyle = theme.wallColor;
          ctx.fillRect(0, JAR_RIM_Y, JAR_LEFT, ARENA_H - JAR_RIM_Y);
          ctx.fillRect(JAR_RIGHT, JAR_RIM_Y, ARENA_W - JAR_RIGHT, ARENA_H - JAR_RIM_Y);
          ctx.fillStyle = theme.floorColor;
          ctx.fillRect(0, JAR_FLOOR, ARENA_W, ARENA_H - JAR_FLOOR);

          ctx.strokeStyle = theme.wallBorder;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(JAR_LEFT, JAR_RIM_Y);
          ctx.lineTo(JAR_LEFT, JAR_FLOOR);
          ctx.lineTo(JAR_RIGHT, JAR_FLOOR);
          ctx.lineTo(JAR_RIGHT, JAR_RIM_Y);
          ctx.stroke();

          // Shockwaves
          for (const sw of shockwavesRef.current) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, sw.alpha);
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Particles
          for (const p of particlesRef.current) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;

            if (p.shape === 'confetti') {
              ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else if (p.shape === 'star') {
              ctx.beginPath();
              for (let i = 0; i < 8; i++) {
                const rad = i % 2 === 0 ? p.size : p.size * 0.4;
                const a = (i * Math.PI) / 4;
                if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
                else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
              }
              ctx.closePath();
              ctx.fill();
            } else if (p.shape === 'heart') {
              const s = p.size * 0.65;
              ctx.beginPath();
              ctx.moveTo(0, s * 0.9);
              ctx.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.9, -s * 1.2, 0, -s * 0.4);
              ctx.bezierCurveTo(s * 0.9, -s * 1.2, s * 1.4, -s * 0.1, 0, s * 0.9);
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }

          // Floating Score Popups
          for (const pop of popupsRef.current) {
            const progress = pop.life / pop.maxLife;
            const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.translate(pop.x, pop.y);
            ctx.scale(pop.scale, pop.scale);
            ctx.font = '800 16px "Bricolage Grotesque", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'rgba(255,255,255,0.92)';
            ctx.strokeText(pop.text, 0, 0);
            ctx.fillStyle = pop.color;
            ctx.fillText(pop.text, 0, 0);

            if (pop.subtext) {
              ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
              ctx.strokeText(pop.subtext, 0, 16);
              ctx.fillStyle = '#D97706';
              ctx.fillText(pop.subtext, 0, 16);
            }
            ctx.restore();
          }

          ctx.restore();
        }
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, [onGameOver, onMergeEvent, onScoreChange]);

  // Keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (statusRef.current !== 'PLAYING') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        aimXRef.current = Math.max(JAR_LEFT + 20, aimXRef.current - 18);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        aimXRef.current = Math.min(JAR_RIGHT - 20, aimXRef.current + 18);
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'BUTTON' || activeTag === 'INPUT') return;
        e.preventDefault();
        dropBall();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dropBall]);

  const toArenaX = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return ARENA_W / 2;
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * ARENA_W;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (statusRef.current !== 'PLAYING') return;
    aimXRef.current = toArenaX(e.clientX);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (statusRef.current !== 'PLAYING') return;
    aimXRef.current = toArenaX(e.clientX);
    if (e.pointerType === 'mouse' && e.button === 0) {
      dropBall(aimXRef.current);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (statusRef.current !== 'PLAYING') return;
    if (e.pointerType !== 'mouse') {
      aimXRef.current = toArenaX(e.clientX);
      dropBall(aimXRef.current);
    }
  };

  return (
    <div className="relative w-full max-w-[420px] mx-auto select-none">
      {/* Danger bar indicator when close to overflow */}
      {dangerRatio > 0.05 && status === 'PLAYING' && (
        <div className="mb-2 flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          <span>Attention ! Trop près de la limite</span>
          <div className="w-24 h-2 bg-red-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-75"
              style={{ width: `${Math.round(dangerRatio * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Game Canvas Container */}
      <div className="relative rounded-2xl overflow-hidden border border-stone-300 shadow-sm bg-white">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className="w-full h-auto aspect-[400/560] block touch-none cursor-crosshair"
        />

        {/* Pause Overlay */}
        {status === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-white rounded-2xl p-6 w-full max-w-[290px] shadow-lg border border-stone-200">
              <h3 className="text-xl font-bold text-slate-900 mb-1">Partie en pause</h3>
              <p className="text-sm text-slate-500 mb-5">
                Les boules se reposent en attendant votre retour.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={onPauseToggle}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  Reprendre
                </button>
                <button
                  onClick={onRestartRequest}
                  className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Recommencer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subtle Bottom Controls Hint + Quick Pause/Reset on mobile */}
      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 px-1">
        <span>Déplacez et relâchez pour lâcher une bille</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPauseToggle}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-slate-700 font-medium transition-colors cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
          <button
            type="button"
            onClick={onRestartRequest}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-slate-700 font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Rejouer
          </button>
        </div>
      </div>
    </div>
  );
};
