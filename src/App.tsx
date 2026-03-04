import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages for code splitting
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const WorkoutsPage = lazy(() => import("@/pages/WorkoutsPage"));
const WorkoutFormPage = lazy(() => import("@/pages/WorkoutFormPage"));
const SessionPage = lazy(() => import("@/pages/SessionPage"));
const HistoryPage = lazy(() => import("@/pages/HistoryPage"));
const ProgressPage = lazy(() => import("@/pages/ProgressPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60, // 1 minuto
    },
    mutations: {
      retry: 0,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AuthRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Auth Route */}
                <Route path="/auth" element={<AuthRedirect />} />

                {/* Protected Routes with Main Layout */}
                <Route
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<WorkoutsPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/progress" element={<ProgressPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>

                {/* Protected Routes without Bottom Nav */}
                <Route
                  path="/workout/new"
                  element={
                    <ProtectedRoute>
                      <WorkoutFormPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workout/:id"
                  element={
                    <ProtectedRoute>
                      <WorkoutFormPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/session/:id"
                  element={
                    <ProtectedRoute>
                      <SessionPage />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
