import { useEffect, useRef } from "react";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function resume(ctx: AudioContext) {
  if (ctx.state === "suspended") void ctx.resume();
}

/** Short digital click — default for most buttons */
function playClick(ctx: AudioContext) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.06);
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.start(t);
  osc.stop(t + 0.07);
}

/** Ascending confirm tone — for submit / approve buttons */
function playConfirm(ctx: AudioContext) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Low warning blip — for destructive / delete buttons */
function playWarn(ctx: AudioContext) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(280, t);
  osc.frequency.exponentialRampToValueAtTime(120, t + 0.09);
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Soft tap — for tabs, nav links, non-primary interactions */
function playTap(ctx: AudioContext) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.04);
  gain.gain.setValueAtTime(0.07, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.start(t);
  osc.stop(t + 0.05);
}

function classifyTarget(el: HTMLElement): "confirm" | "warn" | "tap" | "click" {
  const text = el.textContent?.toLowerCase() ?? "";
  const classes = el.className?.toLowerCase() ?? "";

  // Walk up to find a meaningful interactive element
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const tag = node.tagName.toLowerCase();
    const cls = (node.className ?? "").toLowerCase();
    const txt = (node.textContent ?? "").toLowerCase().trim();

    if (tag === "button" || tag === "a" || node.getAttribute("role") === "button") {
      // Destructive: red-toned classes or destructive text
      if (
        cls.includes("destructive") ||
        cls.includes("red") ||
        txt.includes("delete") ||
        txt.includes("deny") ||
        txt.includes("reject") ||
        txt.includes("remove") ||
        txt.includes("disconnect") ||
        txt.includes("confirm?")
      ) return "warn";

      // Confirm: green / primary submit actions
      if (
        cls.includes("bg-green") ||
        txt.includes("allow") ||
        txt.includes("approve") ||
        txt.includes("submit") ||
        txt.includes("login") ||
        txt.includes("initiate") ||
        txt.includes("pay") ||
        txt.includes("verify") ||
        txt.includes("next") ||
        txt.includes("download") ||
        txt.includes("restore") ||
        txt.includes("actioned")
      ) return "confirm";

      // Tabs / nav links
      if (tag === "a" || cls.includes("tab")) return "tap";

      return "click";
    }
    node = node.parentElement;
  }

  // Input / select focus
  if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") return "tap";

  return "click";
}

export function useSoundEffects() {
  const lastTime = useRef(0);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const now = performance.now();
      // Debounce — ignore clicks fired within 40 ms of each other (e.g. double events)
      if (now - lastTime.current < 40) return;
      lastTime.current = now;

      try {
        const ctx = getCtx();
        resume(ctx);
        const kind = classifyTarget(e.target as HTMLElement);
        if (kind === "confirm") playConfirm(ctx);
        else if (kind === "warn") playWarn(ctx);
        else if (kind === "tap") playTap(ctx);
        else playClick(ctx);
      } catch {
        // AudioContext not supported — fail silently
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
}
