import { useEffect, useRef } from "react";
import type { FilmPlan } from "@/lib/film.functions";

type Scene = "night" | "workshop" | "road" | "water" | "room";

const INK = "#10120f";
const SAGE = "#9aaf96";
const PAPER = "#efeae0";
const WARM = "#d7c4a3";
const SIGNAL = "#c46a5a";

function sceneOf(text: string): Scene {
  const t = text.toLowerCase();
  if (/station|train|platform|letter|night|dark/.test(t)) return "night";
  if (/robot|workshop|screw|machine|stand/.test(t)) return "workshop";
  if (/run|road|dawn|sun|race|finish/.test(t)) return "road";
  if (/sea|river|boat|water|rain|ocean/.test(t)) return "water";
  return "room";
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function figure(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, lean: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.fillStyle = PAPER;
  rounded(ctx, -10 * scale, -46 * scale, 20 * scale, 28 * scale, 8 * scale);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -58 * scale, 8 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNight(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, seed: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#0c1218");
  sky.addColorStop(1, INK);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const random = rng(seed);
  for (let i = 0; i < 40; i += 1) {
    const x = random() * w;
    const y = random() * h * 0.55;
    ctx.globalAlpha = 0.25 + random() * 0.5;
    ctx.fillStyle = PAPER;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#171c18";
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.fillStyle = SAGE;
  ctx.fillRect(0, h * 0.62, w, 3);
  const lampX = [w * 0.22, w * 0.72];
  for (const x of lampX) {
    ctx.fillStyle = SAGE;
    ctx.fillRect(x, h * 0.38, 3, h * 0.24);
    const glow = ctx.createRadialGradient(x, h * 0.38, 4, x, h * 0.46, 90);
    glow.addColorStop(0, "rgba(215,196,163,0.35)");
    glow.addColorStop(1, "rgba(215,196,163,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, h * 0.42, 90, 0, Math.PI * 2);
    ctx.fill();
  }
  const train = ((t * 1.3) % 1.2) - 0.1;
  const tx = w * (1.05 - train);
  if (tx > -40 && tx < w + 40) {
    ctx.fillStyle = SIGNAL;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(tx, h * 0.58, 18, 6);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(tx + 18, h * 0.595, Math.min(160, w - tx), 2);
    ctx.globalAlpha = 1;
  }
  const lift = t > 0.28 && t < 0.48 ? Math.sin(((t - 0.28) / 0.2) * Math.PI) * 18 : 0;
  figure(ctx, w * 0.48, h * 0.64, 1.35, 0);
  ctx.save();
  ctx.translate(w * 0.5, h * 0.56 - lift);
  ctx.fillStyle = WARM;
  rounded(ctx, 0, 0, 16, 11, 1);
  ctx.fill();
  ctx.restore();
}

function drawWorkshop(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1c221b";
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.fillStyle = SAGE;
  ctx.fillRect(w * 0.12, h * 0.7, w * 0.76, 8);
  const step = t < 0.35 ? 0 : t < 0.55 ? (t - 0.35) / 0.2 : 1;
  const wobble = step < 1 ? Math.sin(t * 18) * 0.08 : 0;
  ctx.save();
  ctx.translate(w * 0.48, h * 0.7);
  ctx.rotate(wobble);
  ctx.fillStyle = PAPER;
  rounded(ctx, -28, -70 - step * 16, 56, 40, 6);
  ctx.fill();
  ctx.fillStyle = SAGE;
  ctx.fillRect(-8, -88 - step * 16, 16, 16);
  ctx.fillStyle = PAPER;
  ctx.fillRect(-34, -30, 10, 28);
  ctx.fillRect(22, -30 + (1 - step) * 10, 10, 28);
  ctx.restore();
  if (t > 0.32) {
    const spill = Math.min(1, (t - 0.32) / 0.25);
    ctx.fillStyle = WARM;
    for (let i = 0; i < 8; i += 1) {
      const x = w * 0.58 + spill * (20 + i * 14);
      const y = h * 0.74 + Math.sin(i) * 6;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#243028");
  sky.addColorStop(0.55, "#c4b59a");
  sky.addColorStop(1, INK);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sunY = h * (0.58 - t * 0.28);
  ctx.fillStyle = WARM;
  ctx.beginPath();
  ctx.arc(w * 0.72, sunY, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a2118";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.lineTo(w, h * 0.5);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.strokeStyle = SAGE;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.56);
  ctx.lineTo(w * 0.42, h);
  ctx.moveTo(w * 0.5, h * 0.56);
  ctx.lineTo(w * 0.66, h);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const lead = w * (0.34 + t * 0.22);
  const chase = w * (0.18 + t * 0.36);
  figure(ctx, lead, h * 0.7, 1.2, -0.08);
  figure(ctx, Math.min(lead - 8, chase), h * 0.72, 1.15, -0.06);
}

function drawWater(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, seed: number) {
  ctx.fillStyle = "#121816";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SAGE;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, h * 0.58, w, h * 0.42);
  ctx.globalAlpha = 1;
  for (let i = 0; i < 6; i += 1) {
    const y = h * (0.62 + i * 0.05);
    ctx.strokeStyle = PAPER;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 16) {
      const wave = Math.sin(x * 0.02 + t * 6 + i) * 4;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const drift = ((seed % 80) / 80) * 0.15;
  const bx = w * (0.15 + drift + t * 0.4);
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(bx, h * 0.56);
  ctx.lineTo(bx + 70, h * 0.56);
  ctx.lineTo(bx + 54, h * 0.64);
  ctx.lineTo(bx + 16, h * 0.64);
  ctx.closePath();
  ctx.fill();
}

function drawRoom(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1a2018";
  ctx.fillRect(w * 0.62, h * 0.18, w * 0.24, h * 0.42);
  const glow = ctx.createLinearGradient(w * 0.62, 0, w * 0.86, 0);
  glow.addColorStop(0, "rgba(154,175,150,0)");
  glow.addColorStop(0.5, `rgba(154,175,150,${0.15 + t * 0.25})`);
  glow.addColorStop(1, "rgba(154,175,150,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(w * 0.3, h * 0.18, w * 0.56, h * 0.7);
  figure(ctx, w * 0.38, h * 0.72, 1.4, 0.04);
  ctx.fillStyle = "#22281f";
  ctx.fillRect(w * 0.28, h * 0.66, 70, 8);
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  scene: Scene,
  plan: FilmPlan,
  seed: number,
) {
  if (scene === "night") drawNight(ctx, w, h, t, seed);
  else if (scene === "workshop") drawWorkshop(ctx, w, h, t);
  else if (scene === "road") drawRoad(ctx, w, h, t);
  else if (scene === "water") drawWater(ctx, w, h, t, seed);
  else drawRoom(ctx, w, h, t);

  ctx.fillStyle = PAPER;
  ctx.globalAlpha = 0.8;
  ctx.font = "500 22px Newsreader, Georgia, serif";
  ctx.fillText(plan.title.toUpperCase(), 36, 48);
  ctx.globalAlpha = 1;
  const raw = plan.lines[Math.min(plan.lines.length - 1, Math.floor(t * plan.lines.length))] ?? "";
  const line = raw.length > 64 ? `${raw.slice(0, 61)}…` : raw;
  ctx.fillStyle = "rgba(16,18,15,0.72)";
  ctx.fillRect(0, h - 78, w, 78);
  ctx.fillStyle = PAPER;
  ctx.font = "500 28px Newsreader, Georgia, serif";
  ctx.fillText(line, 36, h - 32);
}

export function SketchFilm({ plan, story }: { plan: FilmPlan; story: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const scene = sceneOf(`${story} ${plan.shot} ${plan.imagePrompt}`);
    const seed = hash(story);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      paint(ctx, canvas.width, canvas.height, 0.45, scene, plan, seed);
      return;
    }
    let frame = 0;
    const timer = window.setInterval(() => {
      const t = (frame % 240) / 240;
      paint(ctx, canvas.width, canvas.height, t, scene, plan, seed);
      frame += 1;
    }, 1000 / 30);
    return () => window.clearInterval(timer);
  }, [plan, story]);

  return (
    <canvas
      ref={ref}
      width={960}
      height={540}
      className="size-full object-cover"
      aria-label={`${plan.title}. Sketch film.`}
    />
  );
}

export function localPlan(story: string): FilmPlan {
  const sentences = story
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const source = sentences.length > 0 ? sentences : [story.trim()];
  const lines = [0, 1, 2].map((index) => (source[index] ?? source[source.length - 1] ?? "").slice(0, 140));
  const title = (source[0] ?? "Untitled").split(/\s+/).slice(0, 4).join(" ");
  return {
    title,
    shot: (source[0] ?? story).slice(0, 220),
    imagePrompt: story.slice(0, 700),
    motionPrompt: story.slice(0, 500),
    lines: lines.filter(Boolean),
  };
}
