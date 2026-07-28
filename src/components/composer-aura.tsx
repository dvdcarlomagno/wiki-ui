"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type p5 from "p5";

const PAD = 56;
const FADE_DIST = 52;
const TARGET_COUNT = 260;

type Particle = {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
  baseAlpha: number;
};

type Box = { x: number; y: number; w: number; h: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function distOutsideBox(x: number, y: number, box: Box) {
  const cx = clamp(x, box.x, box.x + box.w);
  const cy = clamp(y, box.y, box.y + box.h);
  const inside =
    x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
  if (inside) return 0;
  return Math.hypot(x - cx, y - cy);
}

function spawnParticle(p: p5, box: Box): Particle {
  const perimeter = 2 * (box.w + box.h);
  let t = p.random(perimeter);
  let x = box.x;
  let y = box.y;
  let nx = 0;
  let ny = -1;

  if (t < box.w) {
    x = box.x + t;
    y = box.y;
    nx = 0;
    ny = -1;
  } else if (t < box.w + box.h) {
    t -= box.w;
    x = box.x + box.w;
    y = box.y + t;
    nx = 1;
    ny = 0;
  } else if (t < 2 * box.w + box.h) {
    t -= box.w + box.h;
    x = box.x + box.w - t;
    y = box.y + box.h;
    nx = 0;
    ny = 1;
  } else {
    t -= 2 * box.w + box.h;
    x = box.x;
    y = box.y + box.h - t;
    nx = -1;
    ny = 0;
  }

  const nudge = p.random(1, 4);
  return {
    x: x + nx * nudge,
    y: y + ny * nudge,
    life: 0,
    maxLife: p.random(70, 140),
    size: p.random(0.85, 2.2),
    baseAlpha: p.random(0.14, 0.42),
  };
}

type Props = {
  children: ReactNode;
};

/** Ambient p5 flow-field halo. Does not affect child layout width. */
export function ComposerAura({ children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const host = hostRef.current;
    const content = contentRef.current;
    if (!wrap || !host || !content) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let cancelled = false;
    let instance: p5 | null = null;
    let ro: ResizeObserver | null = null;
    let themeObserver: MutationObserver | null = null;

    void import("p5").then(({ default: P5 }) => {
      if (cancelled || !hostRef.current || !contentRef.current) return;

      const box: Box = { x: PAD, y: PAD, w: 100, h: 100 };
      const particles: Particle[] = [];
      let ink = { r: 20, g: 20, b: 22 };

      const readInk = () => {
        const probe = document.createElement("span");
        probe.style.color = "var(--foreground)";
        document.body.appendChild(probe);
        const rgb = getComputedStyle(probe).color;
        document.body.removeChild(probe);
        const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
          ink = { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
        }
      };

      const syncBox = (p: p5) => {
        const contentRect = content.getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();
        const w = Math.max(1, Math.ceil(hostRect.width));
        const h = Math.max(1, Math.ceil(hostRect.height));
        if (p.width !== w || p.height !== h) {
          p.resizeCanvas(w, h);
        }
        // Content box relative to the oversized host canvas
        box.x = contentRect.left - hostRect.left;
        box.y = contentRect.top - hostRect.top;
        box.w = Math.max(1, contentRect.width);
        box.h = Math.max(1, contentRect.height);
      };

      instance = new P5((p: p5) => {
        p.setup = () => {
          const canvas = p.createCanvas(1, 1);
          canvas.style("display", "block");
          canvas.style("width", "100%");
          canvas.style("height", "100%");
          p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
          p.noStroke();
          readInk();
          syncBox(p);
          for (let i = 0; i < TARGET_COUNT; i += 1) {
            const particle = spawnParticle(p, box);
            particle.life = p.random(0, particle.maxLife);
            particles.push(particle);
          }
        };

        p.draw = () => {
          p.clear();
          const t = p.frameCount * 0.004;
          const cx = box.x + box.w * 0.5;
          const cy = box.y + box.h * 0.5;

          for (let i = particles.length - 1; i >= 0; i -= 1) {
            const particle = particles[i];
            const n = p.noise(particle.x * 0.012, particle.y * 0.012, t);
            const angle = n * p.TWO_PI * 3.5;
            const turbX = Math.cos(angle);
            const turbY = Math.sin(angle);

            const dx = particle.x - cx;
            const dy = particle.y - cy;
            const len = Math.hypot(dx, dy) || 1;
            const ox = dx / len;
            const oy = dy / len;

            const speed = 0.28 + n * 0.32;
            particle.x += (ox * 0.65 + turbX * 0.55) * speed;
            particle.y += (oy * 0.65 + turbY * 0.55) * speed;
            particle.life += 1;

            const dist = distOutsideBox(particle.x, particle.y, box);
            const distFade = Math.pow(1 - clamp(dist / FADE_DIST, 0, 1), 0.65);
            const lifeFade = Math.pow(
              1 - particle.life / particle.maxLife,
              0.55,
            );
            const alpha =
              particle.baseAlpha * distFade * clamp(lifeFade, 0, 1);

            if (
              alpha <= 0.01 ||
              dist > FADE_DIST ||
              particle.life >= particle.maxLife
            ) {
              particles[i] = spawnParticle(p, box);
              continue;
            }

            p.fill(ink.r, ink.g, ink.b, alpha * 255);
            p.circle(particle.x, particle.y, particle.size);
          }

          while (particles.length < TARGET_COUNT) {
            particles.push(spawnParticle(p, box));
          }
        };
      }, host);

      ro = new ResizeObserver(() => {
        if (instance) syncBox(instance);
      });
      ro.observe(wrap);
      ro.observe(content);

      themeObserver = new MutationObserver(readInk);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });

      if (cancelled) {
        ro.disconnect();
        themeObserver.disconnect();
        instance.remove();
        instance = null;
      }
    });

    return () => {
      cancelled = true;
      ro?.disconnect();
      themeObserver?.disconnect();
      instance?.remove();
      instance = null;
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full min-w-0 overflow-visible">
      <div
        ref={hostRef}
        className="pointer-events-none absolute -inset-14 z-0 [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full"
        aria-hidden
      />
      <div ref={contentRef} className="relative z-10 w-full min-w-0">
        {children}
      </div>
    </div>
  );
}
