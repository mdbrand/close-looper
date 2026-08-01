import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
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
import Sequences from "./pages/Sequences";
import SenderProfile from "./pages/SenderProfile";
import LandingPage from "./pages/LandingPage";
import SignUpPage from "./pages/SignUpPage";
import SignInPage from "./pages/SignInPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import AdminPanel from "./pages/AdminPanel";
import ReferralPage from "./pages/ReferralPage";
import { useAuth } from "./_core/hooks/useAuth";
import { startLogin } from "./const";
import { Loader2 } from "lucide-react";

// Public paths that don't require authentication
const PUBLIC_PATHS = ["/", "/signup", "/signin", "/terms", "/privacy"];

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
    if (typeof window !== "undefined") {
      // Save the intended URL so we can redirect back after login
      const intended = window.location.pathname + window.location.search;
      if (intended !== "/signin" && intended !== "/") {
        sessionStorage.setItem("cl-redirect-after-login", intended);
      }
      window.location.href = "/signin";
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}

function AppShell() {
  return (
    <AuthGate>
      <DashboardLayout>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/contacts/:id" component={ContactDetail} />
          <Route path="/queue" component={Queue} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/settings" component={Settings} />
          <Route path="/voice-setup" component={VoiceSetup} />
          <Route path="/sender-profile" component={SenderProfile} />
          <Route path="/sequences" component={Sequences} />
          <Route path="/referrals" component={ReferralPage} />
          <Route path="/admin" component={AdminPanel} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    </AuthGate>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="bottom-right" richColors />
          <Switch>
            {/* Public routes — no auth required */}
            <Route path="/" component={LandingPage} />
            <Route path="/signup" component={SignUpPage} />
            <Route path="/signin" component={SignInPage} />
            <Route path="/terms" component={TermsPage} />
            <Route path="/privacy" component={PrivacyPage} />
            {/* All other routes go through AuthGate + DashboardLayout */}
            <Route component={AppShell} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
