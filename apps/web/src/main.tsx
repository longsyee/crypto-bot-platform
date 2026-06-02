import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { useToastStore } from "./hooks/use-toast";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import "./index.css";

const queryClient = new QueryClient();

function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div className="fixed bottom-6 left-1/2 z-[1700] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((toast) => {
        const Icon =
          toast.type === "success"
            ? CheckCircle
            : toast.type === "error"
            ? AlertCircle
            : Info;
        const color =
          toast.type === "success"
            ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
            : toast.type === "error"
            ? "text-red-400 border-red-500/20 bg-red-500/10"
            : "text-blue-400 border-blue-500/20 bg-blue-500/10";

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-md ${color}`}
            style={{ animation: "toastIn 0.3s ease-out" }}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-1 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastContainer />
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
