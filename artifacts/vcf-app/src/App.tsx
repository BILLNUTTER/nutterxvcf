import { Switch, Route, Router as WouterRouter, useSearch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/LandingPage";
import PendingPage from "@/pages/PendingPage";
import AdminPage from "@/pages/AdminPage";
import VcfGuidePage from "@/pages/VcfGuidePage";
import NotFound from "@/pages/not-found";
import { useSoundEffects } from "@/hooks/use-sound-effects";

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
  
  if (params.get("admin") === "true") {
    return <AdminPage />;
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
