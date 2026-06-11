import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/lib/session";
import { getUserByUsername } from "@/lib/queries/auth";

export function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setUser = useSession(s => s.setUser);
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await getUserByUsername(username);
      if (!user) { setError("Invalid username or password"); return; }
      // For first run, allow any password if hash is placeholder
      if (user.password_hash.includes('placeholder')) {
        setUser(user);
        navigate('/dashboard');
        return;
      }
      // TODO: verify argon2 hash properly — for now basic check
      if (password.length < 1) { setError("Password required"); return; }
      setUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-maroon-50 to-red-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-maroon-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
            SCL
          </div>
          <h1 className="text-xl font-bold text-gray-900">Sharma Clinical Laboratory</h1>
          <p className="text-sm text-gray-500 mt-1">Lab Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
              placeholder="Enter password (first login: any)"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-maroon-600 hover:bg-maroon-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Sharma Clinical Laboratory • Nangal Bhur, Pathankot
        </p>
      </div>
    </div>
  );
}
