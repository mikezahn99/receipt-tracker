import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ReceiptsPage from "@/pages/receipts";
import NewReceiptPage from "@/pages/new-receipt";
import JobsPage from "@/pages/jobs";
import LoginPage from "@/pages/login";
import AppLayout from "@/components/AppLayout";
import Navbar from "@/components/Navbar"; // <-- Brought the Navbar out of the toolbox

type AuthUser = {
  id: number;
  username: string;
  role: string;
};

function AppRouter() {
  const {
    data: authUser,
    isLoading,
  } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        throw new Error("Failed to load auth user");
      }

      return response.json();
    },
    retry: false,
  });

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  // If they don't have a badge, keep them at the gate
  if (!authUser) {
    return <LoginPage />;
  }

  // If they are on the clock, hang the Navbar at the very top of the site
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar /> 
      <div className="flex-1">
        <AppLayout>
          <Switch>
            <Route path="/" component={ReceiptsPage} />
            <Route path="/new" component={NewReceiptPage} />
            <Route path="/jobs" component={JobsPage} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
