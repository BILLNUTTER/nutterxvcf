import type { VerifiedUser } from "@workspace/api-client-react";
import { Progress } from "@/components/ui/progress";
import { User, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

interface CapacityBarProps {
  title: string;
  users: VerifiedUser[];
  targetCount?: number;
  accentColor: "primary" | "secondary";
}

export function CapacityBar({ title, users, targetCount = 100, accentColor }: CapacityBarProps) {
  const count = users.length;
  const progress = Math.min((count / targetCount) * 100, 100);

  const neonText = accentColor === "primary"
    ? "text-primary drop-shadow-[0_0_5px_hsl(var(--primary)/0.5)]"
    : "text-secondary drop-shadow-[0_0_5px_hsl(var(--secondary)/0.5)]";
  const bgIndicator = accentColor === "primary" ? "bg-primary" : "bg-secondary";
  const borderClass = accentColor === "primary" ? "border-primary/30" : "border-secondary/30";
  const badgeBg = accentColor === "primary"
    ? "bg-primary/20 text-primary border-primary"
    : "bg-secondary/20 text-secondary border-secondary";

  return (
    <div className={`p-5 rounded-xl border ${borderClass} bg-black/40 backdrop-blur-md space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-bold uppercase tracking-widest ${neonText}`}>{title}</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeBg} drop-shadow-md`}>
          {count} VERIFIED
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono text-muted-foreground">
          <span>SYSTEM CAPACITY</span>
          <span>{count} / {targetCount}</span>
        </div>
        <Progress value={progress} indicatorColor={bgIndicator} className="h-2" />
      </div>
    </div>
  );
}

interface UserDirectoryProps {
  users: VerifiedUser[];
  accentColor: "primary" | "secondary";
}

export function UserDirectory({ users, accentColor }: UserDirectoryProps) {
  const borderClass = accentColor === "primary" ? "border-primary/30" : "border-secondary/30";

  return (
    <div className={`p-5 rounded-xl border ${borderClass} bg-black/40 backdrop-blur-md`}>
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 border-b border-border/50 pb-2">
        Verified Directory
      </h4>

      {users.length === 0 ? (
        <div className="h-40 flex flex-col items-center justify-center text-muted-foreground/50 border border-dashed border-border/30 rounded-md">
          <User className="w-8 h-8 mb-2 opacity-50" />
          <p className="font-mono text-sm">NO USERS VERIFIED YET</p>
        </div>
      ) : (
        <div className="max-h-52 overflow-y-auto pr-2 space-y-2">
          {users.map((user, idx) => (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={user.id}
              className="flex items-center p-2 rounded bg-background/50 border border-border/50 font-mono text-sm"
            >
              <ShieldCheck className={`w-4 h-4 mr-3 ${accentColor === "primary" ? "text-primary" : "text-secondary"}`} />
              <span className="text-foreground">{user.name}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
