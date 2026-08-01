import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Queue from "./pages/Queue";
import CalendarPage from "./pages/CalendarPage";
import Settings from "./pages/Settings";
import VoiceSetup from "./pages/VoiceSetup";
import DashboardLayout from "./components/DashboardLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { startLogin } from "./const";
import { Loader2 } from "lucide-react";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-sm px-6">
          <div>
            <h1 className="text-4xl font-serif text-foreground mb-2">Close Looper</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Stay top of mind with every person who matters — without trying.
            </p>
          </div>
          <button
            onClick={() => startLogin()}
            className="w-full bg-primary text-primary-foreground rounded-lg py-3 px-6 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign in to get started
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/contacts/:id" component={ContactDetail} />
        <Route path="/queue" component={Queue} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/settings" component={Settings} />
        <Route path="/voice-setup" component={VoiceSetup} />
        <Route path="/sender-profile" component={SenderProfile} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" />
          <AuthGate>
            <AppRoutes />
          </AuthGate>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
import SenderProfile from "./pages/SenderProfile";
