import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ReceiptsPage from "@/pages/receipts";
import NewReceiptPage from "@/pages/new-receipt";
import JobsPage from "@/pages/jobs";
import AppLayout from "@/components/AppLayout";

function AppRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={ReceiptsPage} />
        <Route path="/new" component={NewReceiptPage} />
        <Route path="/jobs" component={JobsPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
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
