import { createRoute } from "@tanstack/react-router";
import { useAuth } from "../hooks/use-auth";
import { api } from "../lib/api-client";
import { Link } from "@tanstack/react-router";

export const Route = createRoute({
  path: "/register",
  component: RegisterPage,
});

function RegisterPage() {
  const setAuth = useAuth((s) => s.setAuth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const referralCode = (form.elements.namedItem("referral_code") as HTMLInputElement).value;
    const data = await api<{ accessToken: string; user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        referral_code: referralCode || undefined,
      }),
    });
    setAuth(data.accessToken, data.user);
    window.location.href = "/dashboard";
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-8 rounded-lg border border-gray-700 w-full max-w-sm"
      >
        <h1 className="text-2xl font-bold mb-6">Register</h1>
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="w-full mb-3 p-2 rounded bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password (min 10 chars)"
          className="w-full mb-3 p-2 rounded bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          required
        />
        <input
          name="referral_code"
          type="text"
          placeholder="Referral code (optional)"
          className="w-full mb-4 p-2 rounded bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded font-medium"
        >
          Register
        </button>
        <p className="mt-4 text-sm text-gray-400">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-400 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
