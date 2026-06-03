import { Outlet, createRootRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "../components/layout/sidebar";
import { Header } from "../components/layout/header";
import { useAuth } from "../hooks/use-auth";

export const Route = createRootRoute({
  component: RootComponent,
});

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

function RootComponent() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const token = useAuth((s) => s.token);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  // Auth guard: redirect unauthenticated users from protected routes
  useEffect(() => {
    if (!isPublic && !token) {
      navigate({ to: "/login", replace: true });
    }
  }, [isPublic, token, navigate]);

  if (isPublic) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 p-4 sm:p-5 lg:p-6 overflow-x-hidden overflow-y-auto bg-[var(--bg-base)] text-[var(--text-primary)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
