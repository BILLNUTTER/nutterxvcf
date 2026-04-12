import { Switch, Route, Router as WouterRouter, useSearch } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/LandingPage";
import PendingPage from "@/pages/PendingPage";
import AdminPage from "@/pages/AdminPage";
import VcfGuidePage from "@/pages/VcfGuidePage";
import MaintenancePage from "@/pages/MaintenancePage";
import NotFound from "@/pages/not-found";
import { useSoundEffects } from "@/hooks/use-sound-effects";

interface MaintenanceStatus {
  enabled: boolean;
  title: string;
  reasons: string[];
  eta: string;
}

async function fetchMaintenance(): Promise<MaintenanceStatus> {
  const res = await fetch("/api/maintenance");
  if (!res.ok) return { enabled: false, title: "", reasons: [], eta: "" };
  return res.json() as Promise<MaintenanceStatus>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteHandler() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const isAdmin = params.get("admin") === "true";

  const { data: maintenance } = useQuery<MaintenanceStatus>({
    queryKey: ["maintenance"],
    queryFn: fetchMaintenance,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (isAdmin) {
    return <AdminPage />;
  }

  if (maintenance?.enabled) {
    return <MaintenancePage status={maintenance} />;
  }

  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/pending" component={PendingPage} />
      <Route path="/vcf-guide" component={VcfGuidePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  useSoundEffects();
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <RouteHandler />
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppInner />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
