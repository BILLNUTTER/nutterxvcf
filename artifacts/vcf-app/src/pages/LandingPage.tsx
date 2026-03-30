import { useEffect, useState } from "react";
import { useGetVerifiedUsers, getGetVerifiedUsersQueryKey } from "@workspace/api-client-react";
import { RegistrationForm } from "@/components/RegistrationForm";
import { CapacityBar, UserDirectory } from "@/components/VerifiedList";
import { Activity, ShieldAlert, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  const { data: verifiedUsers } = useGetVerifiedUsers({
    query: { queryKey: getGetVerifiedUsersQueryKey(), refetchInterval: 10000 }
  });
  const [groupLinks, setGroupLinks] = useState({
    standardGroupLink: "https://chat.whatsapp.com/BYzNlaEiCS9LPblEXIYJnA?mode=gi_t",
    botGroupLink: "",
  });

  useEffect(() => {
    fetch("/api/config")
      .then(r => r.json())
      .then(data => setGroupLinks(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (verifiedUsers) {
      const stdName = localStorage.getItem("registered_standard_name");
      const botName = localStorage.getItem("registered_bot_name");

      if (stdName && verifiedUsers.standard.some(u => u.name === stdName)) {
        window.location.href = groupLinks.standardGroupLink;
      } else if (botName && verifiedUsers.bot.some(u => u.name === botName) && groupLinks.botGroupLink) {
        window.location.href = groupLinks.botGroupLink;
      }
    }
  }, [verifiedUsers, groupLinks]);

  return (
    <div className="min-h-screen pb-20">
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt="Cyberpunk Grid"
          className="w-full h-full object-cover opacity-20 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {/* Header */}
        <header className="flex flex-col items-center justify-center text-center mb-16">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="mb-6 relative"
          >
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="Nutterx Logo"
              className="w-32 h-32 object-contain relative z-10 drop-shadow-[0_0_15px_hsl(var(--primary))]"
            />
          </motion.div>

          <h1
            className="text-4xl md:text-6xl font-bold tracking-tighter cyber-glitch mb-4 text-white"
            data-text="NUTTERX VCF SYSTEM"
          >
            NUTTERX VCF SYSTEM
          </h1>
          <div className="flex items-center justify-center space-x-2 text-primary font-mono bg-primary/10 px-4 py-1.5 rounded-full border border-primary/30">
            <Activity className="w-4 h-4 animate-pulse" />
            <span className="text-sm">NETWORK SECURE AND OPERATIONAL</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8">
          {/* STANDARD VCF COLUMN */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <ShieldAlert className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-white tracking-widest">STANDARD PROTOCOL</h2>
            </div>

            {/* 1. Capacity bar */}
            <CapacityBar
              title="Global VCF Network"
              users={verifiedUsers?.standard || []}
              targetCount={500}
              accentColor="primary"
            />

            {/* 2. Registration form */}
            <RegistrationForm
              type="standard"
              title="Standard Registration"
              description="Join the massive global VCF network. Fill your details to get verified."
              crossRegisterLabel="Also initialize WhatsApp Bot VCF registration"
              accentColor="primary"
            />

            {/* 3. Verified users list */}
            <UserDirectory
              users={verifiedUsers?.standard || []}
              accentColor="primary"
            />
          </div>

          {/* WHATSAPP BOT VCF COLUMN */}
          <div className="space-y-6 mt-12 lg:mt-0">
            <div className="flex items-center space-x-3">
              <Smartphone className="w-6 h-6 text-secondary" />
              <h2 className="text-2xl font-bold text-white tracking-widest">BOT PROTOCOL</h2>
            </div>

            {/* 1. Capacity bar */}
            <CapacityBar
              title="Verified Bot Owners"
              users={verifiedUsers?.bot || []}
              targetCount={200}
              accentColor="secondary"
            />

            {/* 2. Registration form */}
            <RegistrationForm
              type="bot"
              title="Bot Owner Registration"
              description="Exclusive network for WhatsApp bot operators."
              crossRegisterLabel="Also initialize Standard VCF registration"
              accentColor="secondary"
            />

            {/* 3. Verified users list */}
            <UserDirectory
              users={verifiedUsers?.bot || []}
              accentColor="secondary"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 w-full p-4 bg-background/80 backdrop-blur-md border-t border-border z-50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs font-mono">
          <p className="text-muted-foreground mb-2 sm:mb-0">
            © {new Date().getFullYear()} NUTTERX SYNDICATE. ALL RIGHTS RESERVED.
          </p>
          <a
            href="https://wa.me/254713881613"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-2 text-primary hover:text-primary/80 transition-colors drop-shadow-[0_0_5px_hsl(var(--primary)/0.5)]"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span>SUPPORT CONTACT: +254 713 881613</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
