import { BALL_LEVELS, SKIN_PALETTES } from '../data/balls';
import { AccessoryId, Emotion, MergeEffectId, SkinId } from '../types/game';

export interface BallVisualState {
  level: number;
  x: number;
  y: number;
  radius: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  emotion: Emotion;
  blinkAmount: number; // 0 = open, 1 = closed
  lookX: number; // -1 to 1
  lookY: number; // -1 to 1
  ageSec: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'circle' | 'star' | 'heart' | 'confetti';
  rotation: number;
  vRot: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

export interface FloatingPopup {
  x: number;
  y: number;
  vy: number;
  text: string;
  subtext?: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export function spawnMergeParticles(
  particles: Particle[],
  shockwaves: Shockwave[],
  x: number,
  y: number,
  level: number,
  effect: MergeEffectId,
  skin: SkinId
): void {
  const def = BALL_LEVELS[Math.min(BALL_LEVELS.length - 1, level - 1)];
  const palette = SKIN_PALETTES[skin][def.level];
  const count = Math.min(26, 10 + level * 2);

  shockwaves.push({
    x,
    y,
    radius: def.radius * 0.45,
    maxRadius: def.radius * 2.1,
    color: effect === 'cosmic' ? '#A78BFA' : palette.primary,
    alpha: 0.75,
  });

  const confettiPalette = ['#F43F5E', '#F59E0B', '#10B981', '#38BDF8', '#A855F7'];

  for (let i = 0; i < count; i++) {
    const theta = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const speed = 1.4 + Math.random() * (2.6 + level * 0.25);

    let shape: Particle['shape'] = 'circle';
    let color = palette.primary;

    if (effect === 'hearts') {
      shape = i % 2 === 0 ? 'heart' : 'circle';
      color = i % 3 === 0 ? '#F43F5E' : i % 3 === 1 ? '#FDA4AF' : palette.highlight;
    } else if (effect === 'cosmic') {
      shape = i % 2 === 0 ? 'star' : 'circle';
      color = i % 3 === 0 ? '#A855F7' : i % 3 === 1 ? '#38BDF8' : '#FDE047';
    } else if (effect === 'confetti') {
      shape = 'confetti';
      color = confettiPalette[i % confettiPalette.length];
    } else {
      shape = i % 3 === 0 ? 'star' : 'circle';
      color = i % 2 === 0 ? palette.highlight : palette.primary;
    }

    particles.push({
      x,
      y,
      vx: Math.cos(theta) * speed,
      vy: Math.sin(theta) * speed - 0.8,
      size: shape === 'confetti' ? 5 + Math.random() * 4 : 3 + Math.random() * 4.5,
      color,
      alpha: 1,
      life: 0,
      maxLife: 0.45 + Math.random() * 0.35,
      shape,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.25,
    });
  }
}

export function drawBallCharacter(
  ctx: CanvasRenderingContext2D,
  ball: BallVisualState,
  skin: SkinId,
  accessory: AccessoryId,
  isSilhouette = false
): void {
  const def = BALL_LEVELS[Math.min(BALL_LEVELS.length - 1, ball.level - 1)];
  const colors = SKIN_PALETTES[skin][def.level] || {
    primary: def.colorPrimary,
    secondary: def.colorSecondary,
    highlight: def.colorHighlight,
  };
  const r = ball.radius;

  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.angle);
  ctx.scale(ball.scaleX, ball.scaleY);

  if (isSilhouette) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#CBD5E1';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#94A3B8';
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = `700 ${Math.max(12, Math.round(r * 0.65))}px "Bricolage Grotesque", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 1);
    ctx.restore();
    return;
  }

  // Aura for Level 11 (Celeste)
  if (def.specialFeature === 'cosmic') {
    const aura = ctx.createRadialGradient(0, 0, r * 0.85, 0, 0, r * 1.18);
    aura.addColorStop(0, 'rgba(236, 72, 153, 0.28)');
    aura.addColorStop(0.5, 'rgba(139, 92, 246, 0.16)');
    aura.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
    ctx.fillStyle = aura;
    ctx.fill();
  }

  // Special ears for Framboise (level 4)
  if (def.specialFeature === 'ears') {
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.arc(-r * 0.68, -r * 0.68, r * 0.25, 0, Math.PI * 2);
    ctx.arc(r * 0.68, -r * 0.68, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Main sphere gradient
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.32, r * 0.1, 0, 0, r);
  grad.addColorStop(0, colors.highlight);
  grad.addColorStop(0.35, colors.primary);
  grad.addColorStop(1, colors.secondary);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Skin-specific surface texture
  if (skin === 'candy') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(2, r * 0.14);
    for (let sx = -r * 1.5; sx < r * 1.5; sx += r * 0.55) {
      ctx.beginPath();
      ctx.moveTo(sx, -r);
      ctx.lineTo(sx + r * 0.6, r);
      ctx.stroke();
    }
    ctx.restore();
  } else if (skin === 'starry') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const dots = [
      [-0.5, -0.45, 0.06],
      [0.52, -0.32, 0.05],
      [-0.4, 0.48, 0.05],
      [0.45, 0.44, 0.07],
    ];
    dots.forEach(([dx, dy, ds]) => {
      ctx.beginPath();
      ctx.arc(r * dx, r * dy, Math.max(1.2, r * ds), 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (skin === 'watercolor') {
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crisp gentle outline for clear legibility
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1.4, r * 0.045);
  ctx.strokeStyle = colors.secondary;
  ctx.stroke();

  // Top glossy specular highlight
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.42, r * 0.28, r * 0.14, -Math.PI / 5, 0, Math.PI * 2);
  ctx.fillStyle = skin === 'candy' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.34)';
  ctx.fill();

  // Sprout / Stem / Halo / Cosmic orbiting stars
  if (def.specialFeature === 'sprout') {
    ctx.save();
    ctx.strokeStyle = '#365314';
    ctx.lineWidth = Math.max(1.8, r * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.88);
    ctx.quadraticCurveTo(r * 0.05, -r * 1.2, r * 0.2, -r * 1.24);
    ctx.stroke();
    ctx.fillStyle = '#65A30D';
    ctx.beginPath();
    ctx.ellipse(r * 0.24, -r * 1.2, r * 0.22, r * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (def.specialFeature === 'stem') {
    ctx.fillStyle = '#581C87';
    ctx.beginPath();
    ctx.roundRect(-r * 0.08, -r * 1.08, r * 0.16, r * 0.22, 3);
    ctx.fill();
  } else if (def.specialFeature === 'halo') {
    ctx.save();
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = Math.max(2, r * 0.055);
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.08, r * 0.42, r * 0.11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (def.specialFeature === 'cosmic') {
    const orbit = ball.ageSec * 1.8;
    for (let i = 0; i < 3; i++) {
      const a = orbit + (i * Math.PI * 2) / 3;
      const ox = Math.cos(a) * r * 1.1;
      const oy = Math.sin(a) * r * 0.42 - r * 0.15;
      drawMiniStar(ctx, ox, oy, r * 0.085, '#FEF08A');
    }
  }

  // Face container (slight counter-rotation bias so face stays expressive + look offset)
  const faceX = ball.lookX * r * 0.09;
  const faceY = ball.lookY * r * 0.07 + r * 0.04;
  ctx.save();
  ctx.translate(faceX, faceY);

  const eyeSpacing = r * 0.34;
  const eyeY = -r * 0.08;
  const eyeRadius = Math.max(2.1, r * 0.125);
  const darkInk = '#1E1B2E';

  // Rosy cheeks
  const cheekAlpha = accessory === 'blush' ? 0.72 : 0.42;
  const cheekRadiusX = r * (accessory === 'blush' ? 0.17 : 0.13);
  const cheekRadiusY = r * (accessory === 'blush' ? 0.1 : 0.08);
  ctx.fillStyle = def.cheekColor;
  ctx.globalAlpha = cheekAlpha;
  ctx.beginPath();
  ctx.ellipse(-eyeSpacing * 1.25, eyeY + r * 0.22, cheekRadiusX, cheekRadiusY, 0, 0, Math.PI * 2);
  ctx.ellipse(eyeSpacing * 1.25, eyeY + r * 0.22, cheekRadiusX, cheekRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Freckles for Mandarine
  if (def.specialFeature === 'freckles') {
    ctx.fillStyle = '#9A3412';
    ctx.globalAlpha = 0.45;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(side * eyeSpacing * 1.15, eyeY + r * 0.18, r * 0.025, 0, Math.PI * 2);
      ctx.arc(side * eyeSpacing * 1.32, eyeY + r * 0.22, r * 0.025, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // Draw Eyes based on Emotion & Blink
  const isBlinking = ball.blinkAmount > 0.65;
  if (ball.emotion === 'sleepy' || isBlinking) {
    // Closed curved eyes
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = Math.max(1.6, r * 0.065);
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      const ex = side * eyeSpacing;
      ctx.beginPath();
      if (ball.emotion === 'sleepy') {
        ctx.arc(ex, eyeY, eyeRadius * 0.95, 0.15 * Math.PI, 0.85 * Math.PI);
      } else {
        ctx.moveTo(ex - eyeRadius * 0.85, eyeY);
        ctx.lineTo(ex + eyeRadius * 0.85, eyeY);
      }
      ctx.stroke();
    });
  } else if (ball.emotion === 'love') {
    // Heart eyes
    [-1, 1].forEach((side) => {
      drawMiniHeart(ctx, side * eyeSpacing, eyeY, eyeRadius * 1.25, '#BE123C');
    });
  } else if (ball.emotion === 'happy') {
    // Joyful arcs or shiny bright eyes
    if (r >= 24) {
      ctx.strokeStyle = darkInk;
      ctx.lineWidth = Math.max(2, r * 0.072);
      ctx.lineCap = 'round';
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.arc(side * eyeSpacing, eyeY + eyeRadius * 0.25, eyeRadius * 0.9, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.stroke();
      });
    } else {
      drawStandardEyes(ctx, eyeSpacing, eyeY, eyeRadius, ball.lookX, ball.lookY, darkInk);
    }
  } else if (ball.emotion === 'surprised' || ball.emotion === 'scared') {
    // Wide open eyes with white sclera and small startled pupil
    [-1, 1].forEach((side) => {
      const ex = side * eyeSpacing;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeRadius * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, r * 0.04);
      ctx.strokeStyle = darkInk;
      ctx.stroke();

      const jitter = ball.emotion === 'scared' ? Math.sin(ball.ageSec * 28) * r * 0.025 : 0;
      ctx.fillStyle = darkInk;
      ctx.beginPath();
      ctx.arc(ex + jitter, eyeY, eyeRadius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    drawStandardEyes(ctx, eyeSpacing, eyeY, eyeRadius, ball.lookX, ball.lookY, darkInk);
  }

  // Eyebrows for angry / sad / scared
  if (ball.emotion === 'angry') {
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = Math.max(1.6, r * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-eyeSpacing - eyeRadius, eyeY - eyeRadius * 1.6);
    ctx.lineTo(-eyeSpacing + eyeRadius * 0.7, eyeY - eyeRadius * 0.95);
    ctx.moveTo(eyeSpacing + eyeRadius, eyeY - eyeRadius * 1.6);
    ctx.lineTo(eyeSpacing - eyeRadius * 0.7, eyeY - eyeRadius * 0.95);
    ctx.stroke();
  } else if (ball.emotion === 'sad' || ball.emotion === 'scared') {
    ctx.strokeStyle = darkInk;
    ctx.lineWidth = Math.max(1.4, r * 0.055);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-eyeSpacing - eyeRadius, eyeY - eyeRadius * 1.1);
    ctx.lineTo(-eyeSpacing + eyeRadius * 0.6, eyeY - eyeRadius * 1.65);
    ctx.moveTo(eyeSpacing + eyeRadius, eyeY - eyeRadius * 1.1);
    ctx.lineTo(eyeSpacing - eyeRadius * 0.6, eyeY - eyeRadius * 1.65);
    ctx.stroke();
  }

  // Draw Mouth based on Emotion
  const mouthY = eyeY + r * 0.25;
  ctx.strokeStyle = darkInk;
  ctx.fillStyle = '#9F1239';
  ctx.lineWidth = Math.max(1.6, r * 0.065);
  ctx.lineCap = 'round';

  if (ball.emotion === 'happy' || ball.emotion === 'love') {
    ctx.beginPath();
    ctx.arc(0, mouthY - r * 0.04, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    if (r >= 32 && ball.emotion === 'happy') {
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.arc(0, mouthY - r * 0.03, r * 0.11, 0, Math.PI);
      ctx.fill();
    }
  } else if (ball.emotion === 'surprised') {
    ctx.fillStyle = darkInk;
    ctx.beginPath();
    ctx.ellipse(0, mouthY + r * 0.03, r * 0.085, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (ball.emotion === 'sad' || ball.emotion === 'angry') {
    ctx.beginPath();
    ctx.arc(0, mouthY + r * 0.14, r * 0.14, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
  } else if (ball.emotion === 'scared') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, mouthY + r * 0.04);
    ctx.quadraticCurveTo(-r * 0.08, mouthY - r * 0.04, 0, mouthY + r * 0.04);
    ctx.quadraticCurveTo(r * 0.08, mouthY + r * 0.12, r * 0.16, mouthY + r * 0.04);
    ctx.stroke();
  } else if (ball.emotion === 'sleepy') {
    ctx.beginPath();
    ctx.arc(0, mouthY + r * 0.02, r * 0.055, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Gentle idle smile
    ctx.beginPath();
    ctx.arc(0, mouthY - r * 0.02, r * 0.12, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  // Sweat drop when scared
  if (ball.emotion === 'scared' && r >= 22) {
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    const dx = r * 0.56;
    const dy = -r * 0.35;
    ctx.moveTo(dx, dy - r * 0.11);
    ctx.quadraticCurveTo(dx + r * 0.08, dy + r * 0.04, dx, dy + r * 0.09);
    ctx.quadraticCurveTo(dx - r * 0.08, dy + r * 0.04, dx, dy - r * 0.11);
    ctx.fill();
  }

  // Floating "z" when sleepy
  if (ball.emotion === 'sleepy' && r >= 26) {
    ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
    ctx.font = `700 ${Math.max(10, Math.round(r * 0.24))}px "Bricolage Grotesque", sans-serif`;
    ctx.fillText('z', r * 0.52, -r * 0.45 - ((ball.ageSec * 8) % 6));
  }

  // Accessories from shop
  if (accessory === 'glasses' && def.level >= 4) {
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.beginPath();
    ctx.arc(-eyeSpacing, eyeY, eyeRadius * 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(eyeSpacing, eyeY, eyeRadius * 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-eyeSpacing + eyeRadius * 1.45, eyeY);
    ctx.lineTo(eyeSpacing - eyeRadius * 1.45, eyeY);
    ctx.stroke();
  } else if (accessory === 'stars' && (ball.emotion === 'happy' || ball.emotion === 'love')) {
    drawMiniStar(ctx, -r * 0.6, -r * 0.45, r * 0.11, '#FDE047');
    drawMiniStar(ctx, r * 0.62, -r * 0.4, r * 0.09, '#FDE047');
  }

  ctx.restore(); // end face translation

  // Crown or bow accessory on top of head
  if (accessory === 'crown') {
    if (def.level >= 6) {
      // Cute golden crown
      ctx.save();
      ctx.translate(0, -r * 0.92);
      ctx.fillStyle = '#FBBF24';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = Math.max(1.2, r * 0.04);
      ctx.beginPath();
      ctx.moveTo(-r * 0.26, 0);
      ctx.lineTo(-r * 0.3, -r * 0.24);
      ctx.lineTo(-r * 0.1, -r * 0.1);
      ctx.lineTo(0, -r * 0.3);
      ctx.lineTo(r * 0.1, -r * 0.1);
      ctx.lineTo(r * 0.3, -r * 0.24);
      ctx.lineTo(r * 0.26, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      // Cute bow
      ctx.save();
      ctx.translate(r * 0.35, -r * 0.85);
      ctx.rotate(0.35);
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.ellipse(-r * 0.12, 0, r * 0.14, r * 0.09, -0.3, 0, Math.PI * 2);
      ctx.ellipse(r * 0.12, 0, r * 0.14, r * 0.09, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFE4E6';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawStandardEyes(
  ctx: CanvasRenderingContext2D,
  eyeSpacing: number,
  eyeY: number,
  eyeRadius: number,
  lookX: number,
  lookY: number,
  ink: string
): void {
  [-1, 1].forEach((side) => {
    const ex = side * eyeSpacing;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(ex + lookX * eyeRadius * 0.2, eyeY + lookY * eyeRadius * 0.2, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Specular eye catchlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - eyeRadius * 0.32, eyeY - eyeRadius * 0.32, Math.max(1, eyeRadius * 0.35), 0, Math.PI * 2);
    ctx.fill();
  });
}

export function drawMiniHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  const s = size * 0.55;
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.9, -s * 1.2, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.9, -s * 1.2, s * 1.4, -s * 0.1, 0, s * 0.9);
  ctx.fill();
  ctx.restore();
}

export function drawMiniStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.4;
    const angle = (i * Math.PI) / 4;
    if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
