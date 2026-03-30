import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  number: string;
  label?: string;
  size?: "sm" | "lg";
}

export function CopyableNumber({ number, label, size = "lg" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = number;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (size === "lg") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        {label && (
          <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-amber-400/70">
            {label}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="group flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-400 transition-all shadow-[0_0_15px_rgba(251,191,36,0.2)] hover:shadow-[0_0_25px_rgba(251,191,36,0.35)] active:scale-95"
          title="Tap to copy"
        >
          <span className="text-2xl font-bold font-mono tracking-widest text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
            {number}
          </span>
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 group-hover:bg-amber-500/30 transition-colors shrink-0">
            {copied
              ? <Check className="w-3.5 h-3.5 text-green-400" />
              : <Copy className="w-3.5 h-3.5 text-amber-400" />
            }
          </span>
        </button>
        <span className="text-[10px] font-mono text-amber-400/60">
          {copied ? "✓ Copied!" : "Tap to copy"}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={handleCopy}
      className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 transition-all active:scale-95"
      title="Tap to copy"
    >
      <span className="font-bold font-mono tracking-widest text-amber-300 text-sm">
        {number}
      </span>
      {copied
        ? <Check className="w-3 h-3 text-green-400 shrink-0" />
        : <Copy className="w-3 h-3 text-amber-400/70 group-hover:text-amber-400 shrink-0" />
      }
    </button>
  );
}
