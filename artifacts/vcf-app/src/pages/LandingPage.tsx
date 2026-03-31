import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetVerifiedUsers, getGetVerifiedUsersQueryKey } from "@workspace/api-client-react";
import { StandardWizard } from "@/components/StandardWizard";
import { BotFlow } from "@/components/BotFlow";
import { CapacityBar, UserDirectory } from "@/components/VerifiedList";
import {
  Activity,
  ShieldAlert,
  Smartphone,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VcfSettings {
  standardTarget: number;
  botTarget: number;
  standardApproved: number;
  botApproved: number;
}

async function fetchSettings(): Promise<VcfSettings> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json() as Promise<VcfSettings>;
}

async function tryRedirectWithClaimToken(claimToken: string, type: "standard" | "bot") {
  try {
    const res = await fetch("/api/redirect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimToken, type }),
    });
    if (res.ok) {
      const { redirectUrl } = await res.json() as { redirectUrl: string };
      if (redirectUrl) window.location.href = redirectUrl;
    }
  } catch {
  }
}

function downloadVcf(type: "standard" | "bot") {
  window.open(`/api/vcf/download?type=${type}`, "_blank");
}

type Tab = "standard" | "bot";

const TABS: { id: Tab; label: string; shortLabel: string; icon: React.ReactNode; accent: string; border: string; glow: string }[] = [
  {
    id: "standard",
    label: "Standard VCF",
    shortLabel: "Standard",
    icon: <ShieldAlert className="w-5 h-5" />,
    accent: "text-primary",
    border: "border-primary",
    glow: "shadow-[0_0_20px_hsl(var(--primary)/0.4)]",
  },
  {
    id: "bot",
    label: "WhatsApp Bot VCF",
    shortLabel: "Bot VCF",
    icon: <Smartphone className="w-5 h-5" />,
    accent: "text-secondary",
    border: "border-secondary",
    glow: "shadow-[0_0_20px_hsl(var(--secondary)/0.4)]",
  },
];

const variants = {
  enter: { opacity: 0, y: 18, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.18, ease: "easeIn" as const } },
};

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("standard");

  const { data: verifiedUsers } = useGetVerifiedUsers({
    query: { queryKey: getGetVerifiedUsersQueryKey(), refetchInterval: 10000 }
  });

  const { data: settings } = useQuery<VcfSettings>({
    queryKey: ["/api/settings"],
    queryFn: fetchSettings,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  useEffect(() => {
    const stdToken = localStorage.getItem("vcf_claim_standard");
    const botToken = localStorage.getItem("vcf_claim_bot");
    if (stdToken) void tryRedirectWithClaimToken(stdToken, "standard");
    if (botToken) void tryRedirectWithClaimToken(botToken, "bot");
  }, []);

  const standardTarget = settings?.standardTarget ?? 500;
  const botTarget = settings?.botTarget ?? 200;

  const stdUsers = verifiedUsers?.standard || [];
  const botUsers = verifiedUsers?.bot || [];

  const stdApproved = settings?.standardApproved ?? stdUsers.filter(u => u.status === "approved").length;
  const botApproved = settings?.botApproved ?? botUsers.filter(u => u.status === "approved").length;

  const stdTargetReached = stdApproved >= standardTarget;
  const botTargetReached = botApproved >= botTarget;

  return (
    <div className="min-h-screen pb-20">
      {/* Background */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt=""
          className="w-full h-full object-cover opacity-20 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">

        {/* ── Header ── */}
        <header className="flex flex-col items-center text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="mb-5 relative"
          >
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="Nutterx Logo"
              className="w-28 h-28 object-contain relative z-10 drop-shadow-[0_0_15px_hsl(var(--primary))]"
            />
          </motion.div>

          <h1
            className="text-4xl md:text-5xl font-bold tracking-tighter cyber-glitch mb-3 text-white"
            data-text="NUTTERX VCF SYSTEM"
          >
            NUTTERX VCF SYSTEM
          </h1>
          <div className="flex items-center gap-2 text-primary font-mono bg-primary/10 px-4 py-1.5 rounded-full border border-primary/30 text-sm">
            <Activity className="w-4 h-4 animate-pulse" />
            NETWORK SECURE AND OPERATIONAL
          </div>
        </header>

        {/* ── Tab Switcher ── */}
        <div className="flex gap-3 mb-8">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2
                  rounded-xl border-2 px-3 py-3.5 sm:py-4 font-bold tracking-wider
                  transition-all duration-200 cursor-pointer
                  ${active
                    ? `${tab.border} ${tab.accent} bg-black/60 ${tab.glow}`
                    : "border-border/40 text-muted-foreground bg-black/20 hover:border-border/70 hover:text-white hover:bg-black/40"
                  }
                `}
              >
                <span className={`${active ? tab.accent : ""} transition-colors`}>{tab.icon}</span>
                <span className="text-[11px] sm:text-sm leading-tight text-center">
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </span>
                {active && (
                  <ChevronRight className={`hidden sm:block w-4 h-4 ml-auto ${tab.accent} opacity-60`} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          {activeTab === "standard" && (
            <motion.div
              key="standard"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-5"
            >
              <CapacityBar
                title="Global VCF Network"
                users={stdUsers}
                targetCount={standardTarget}
                accentColor="primary"
                isTargetReached={stdTargetReached}
                onDownloadVcf={stdTargetReached ? () => downloadVcf("standard") : undefined}
              />

              <StandardWizard />

              {/* Standard directory */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2 px-1">
                  <ShieldAlert className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold tracking-widest text-primary uppercase">
                    Standard VCF Directory
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                    Ksh. 10 fee
                  </span>
                </div>
                <UserDirectory
                  users={stdUsers}
                  accentColor="primary"
                  verificationNote={{ kind: "payment", amount: "10", mpesaNumber: "0758891491" }}
                />
              </div>
            </motion.div>
          )}

          {activeTab === "bot" && (
            <motion.div
              key="bot"
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-5"
            >
              <CapacityBar
                title="Verified Bot Owners"
                users={botUsers}
                targetCount={botTarget}
                accentColor="secondary"
                isTargetReached={botTargetReached}
                onDownloadVcf={botTargetReached ? () => downloadVcf("bot") : undefined}
                verificationNote={{ kind: "free" }}
              />

              <BotFlow />

              {/* Bot directory */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2 px-1">
                  <Smartphone className="w-4 h-4 text-secondary" />
                  <span className="text-xs font-bold tracking-widest text-secondary uppercase">
                    Bot VCF Directory
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-0.5">
                    FREE
                  </span>
                </div>
                <UserDirectory
                  users={botUsers}
                  accentColor="secondary"
                  verificationNote={{ kind: "free" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 w-full p-4 bg-background/80 backdrop-blur-md border-t border-border z-50">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs font-mono gap-2">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} NUTTERX SYNDICATE. ALL RIGHTS RESERVED.
          </p>
          <a
            href="https://wa.me/254758891491"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors drop-shadow-[0_0_5px_hsl(var(--primary)/0.5)]"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            SUPPORT CONTACT: +254 713 881613
          </a>
        </div>
      </footer>
    </div>
  );
}
