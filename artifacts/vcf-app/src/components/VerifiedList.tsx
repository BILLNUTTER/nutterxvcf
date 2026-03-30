import type { VerifiedUser } from "@workspace/api-client-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { User, ShieldCheck, PauseCircle, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { CopyableNumber } from "@/components/CopyableNumber";

type VerificationNote =
  | { kind: "payment"; amount: string; mpesaNumber: string }
  | { kind: "free" };

interface CapacityBarProps {
  title: string;
  users: VerifiedUser[];
  targetCount?: number;
  accentColor: "primary" | "secondary";
  onDownloadVcf?: () => void;
  isTargetReached?: boolean;
  verificationNote?: VerificationNote;
}

export function CapacityBar({
  title,
  users,
  targetCount = 100,
  accentColor,
  onDownloadVcf,
  isTargetReached = false,
  verificationNote,
}: CapacityBarProps) {
  const approvedCount = users.filter((u) => u.status === "approved").length;
  const progress = Math.min((approvedCount / targetCount) * 100, 100);

  const neonText = accentColor === "primary"
    ? "text-primary drop-shadow-[0_0_5px_hsl(var(--primary)/0.5)]"
    : "text-secondary drop-shadow-[0_0_5px_hsl(var(--secondary)/0.5)]";
  const bgIndicator = accentColor === "primary" ? "bg-primary" : "bg-secondary";
  const borderClass = accentColor === "primary" ? "border-primary/30" : "border-secondary/30";
  const badgeBg = accentColor === "primary"
    ? "bg-primary/20 text-primary border-primary"
    : "bg-secondary/20 text-secondary border-secondary";
  const btnClass = accentColor === "primary"
    ? "bg-primary/10 border-primary/50 text-primary hover:bg-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.3)]"
    : "bg-secondary/10 border-secondary/50 text-secondary hover:bg-secondary/20 shadow-[0_0_10px_hsl(var(--secondary)/0.3)]";

  return (
    <div className={`p-5 rounded-xl border ${borderClass} bg-black/40 backdrop-blur-md space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-bold uppercase tracking-widest ${neonText}`}>{title}</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeBg} drop-shadow-md`}>
          {approvedCount} VERIFIED
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono text-muted-foreground">
          <span>SYSTEM CAPACITY</span>
          <span>{approvedCount} / {targetCount}</span>
        </div>
        <Progress value={progress} indicatorColor={bgIndicator} className="h-2" />
      </div>

      {/* Verification requirement notice */}
      {verificationNote && (
        verificationNote.kind === "payment" ? (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/40 px-4 py-4 text-amber-300 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="text-xs font-bold font-mono uppercase tracking-wide text-amber-300">
                Verification Fee Required — Send Ksh. {verificationNote.amount} to:
              </span>
            </div>
            <div className="flex justify-center">
              <CopyableNumber number={verificationNote.mpesaNumber} label="M-Pesa Number" size="lg" />
            </div>
            <p className="text-[11px] font-mono text-amber-300/70 text-center">
              After paying, paste your M-Pesa confirmation message in the <span className="text-white font-bold">Payment</span> tab.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-green-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-green-300">
              Bot Owner Verification is FREE
            </p>
          </div>
        )
      )}

      {isTargetReached && onDownloadVcf && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            onClick={onDownloadVcf}
            className={`w-full mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border font-bold text-sm uppercase tracking-widest transition-colors ${btnClass}`}
          >
            <Download className="w-4 h-4" />
            DOWNLOAD VCF CONTACTS
          </button>
        </motion.div>
      )}
    </div>
  );
}

interface UserDirectoryProps {
  users: VerifiedUser[];
  accentColor: "primary" | "secondary";
  verificationNote?: VerificationNote;
}

export function UserDirectory({ users, accentColor, verificationNote }: UserDirectoryProps) {
  const borderClass = accentColor === "primary" ? "border-primary/30" : "border-secondary/30";
  const iconColor = accentColor === "primary" ? "text-primary" : "text-secondary";

  return (
    <div className={`p-5 rounded-xl border ${borderClass} bg-black/40 backdrop-blur-md`}>
      <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Verified Directory
        </h4>
        {verificationNote && (
          verificationNote.kind === "payment" ? (
            <span className="flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" />
              Ksh. {verificationNote.amount} fee
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3" />
              FREE
            </span>
          )
        )}
      </div>

      {/* Directory-level verification reminder */}
      {verificationNote?.kind === "payment" && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-3 text-[11px] font-mono text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5 leading-snug">
          <span>Pay <span className="font-bold text-amber-300">Ksh. {verificationNote.amount}</span> to join →</span>
          <CopyableNumber number={verificationNote.mpesaNumber} size="sm" />
        </div>
      )}

      {users.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-6 font-mono">
          NO VERIFIED USERS YET
        </p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {users.map((user, i) => (
            <motion.li
              key={user.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {user.status === "suspended" ? (
                  <PauseCircle className="w-4 h-4 shrink-0 text-yellow-400" />
                ) : (
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${iconColor}`} />
                )}
                <span
                  className={`text-sm font-mono truncate ${
                    user.status === "suspended"
                      ? "line-through text-muted-foreground"
                      : "text-white"
                  }`}
                >
                  {user.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {user.status === "suspended" && (
                  <Badge variant="suspended" className="text-[10px] py-0">SUSPENDED</Badge>
                )}
                <User className="w-3 h-3 text-muted-foreground" />
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
