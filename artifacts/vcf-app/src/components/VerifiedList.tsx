import type { VerifiedUser } from "@workspace/api-client-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { User, ShieldCheck, PauseCircle, Download, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface CapacityBarProps {
  title: string;
  users: VerifiedUser[];
  targetCount?: number;
  accentColor: "primary" | "secondary";
  onDownloadVcf?: () => void;
  isTargetReached?: boolean;
  isFree?: boolean;
}

export function CapacityBar({
  title,
  users,
  targetCount = 100,
  accentColor,
  onDownloadVcf,
  isTargetReached = false,
  isFree,
}: CapacityBarProps) {
  const approvedCount = users.filter((u) => u.status === "approved").length;
  const progress = Math.min((approvedCount / targetCount) * 100, 100);

  return (
    <div className="p-5 rounded-xl border border-orange-500/40 bg-black/40 backdrop-blur-md space-y-3 shadow-[0_0_18px_rgba(249,115,22,0.08)]">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold uppercase tracking-widest text-orange-400 drop-shadow-[0_0_6px_rgba(249,115,22,0.55)]">
          {title}
        </h3>
        <span className="px-3 py-1 rounded-full text-xs font-bold border bg-orange-500/20 text-orange-300 border-orange-500/60 drop-shadow-md">
          {approvedCount} VERIFIED
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono text-muted-foreground">
          <span>SYSTEM CAPACITY</span>
          <span className="text-orange-300/80">{approvedCount} / {targetCount}</span>
        </div>
        <Progress value={progress} indicatorColor="bg-orange-500" className="h-2.5 bg-orange-950/60" />
      </div>

      {isFree && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-green-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-green-300">
            Bot Owner Verification is FREE
          </p>
        </div>
      )}

      {isTargetReached && onDownloadVcf && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            onClick={onDownloadVcf}
            className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border font-bold text-sm uppercase tracking-widest transition-colors bg-orange-500/10 border-orange-500/50 text-orange-400 hover:bg-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.25)]"
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
}

export function UserDirectory({ users, accentColor }: UserDirectoryProps) {
  const borderClass = accentColor === "primary" ? "border-primary/30" : "border-secondary/30";
  const iconColor = accentColor === "primary" ? "text-primary" : "text-secondary";

  return (
    <div className={`p-5 rounded-xl border ${borderClass} bg-black/40 backdrop-blur-md`}>
      <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Verified Directory
        </h4>
      </div>

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
