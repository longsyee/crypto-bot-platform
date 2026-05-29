import { useAuth } from "../../hooks/use-auth";
import { Moon, Sun, LogOut } from "lucide-react";
import { useState, useEffect } from "react";

export function Header() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
      <div className="text-sm text-gray-400">
        {user?.email && <span>{user.email}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDark((d) => !d)}
          className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
          title="Toggle dark mode"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={logout}
          className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
