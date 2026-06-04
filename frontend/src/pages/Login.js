import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeSlash, Warning } from '@phosphor-icons/react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const formatApiErrorDetail = (detail) => {
    if (detail == null) return 'Something went wrong. Please try again.';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail))
      return detail
        .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
        .filter(Boolean)
        .join(' ');
    if (detail && typeof detail.msg === 'string') return detail.msg;
    return String(detail);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image */}
      <div
        className="hidden lg:block lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1595411425732-e69c1abe2763?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGdlb21ldHJpYyUyMHN3aXNzJTIwZGVzaWduJTIwYmxhY2slMjBhbmQlMjB3aGl0ZXxlbnwwfHx8fDE3ODA1Nzg0MjN8MA&ixlib=rb-4.1.0&q=85)',
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="text-white text-center px-8">
            <h1 className="text-5xl font-black mb-4" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              PO REVIEW HUB
            </h1>
            <p className="text-lg font-mono uppercase tracking-wider">Production Cost Analysis System</p>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2
              className="text-4xl font-black mb-2"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
              data-testid="login-title"
            >
              LOGIN
            </h2>
            <p className="text-sm font-mono uppercase tracking-wider text-gray-600">Access Your Dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 flex items-start gap-3" data-testid="login-error">
              <Warning size={20} weight="bold" className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 focus:border-black focus:outline-none text-base"
                placeholder="admin@poreview.com"
                data-testid="email-input"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 focus:border-black focus:outline-none text-base pr-12"
                  placeholder="••••••••"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors"
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-3 font-mono font-bold uppercase tracking-wider hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                boxShadow: !loading ? '4px 4px 0px 0px rgba(0,0,0,1)' : 'none',
              }}
              data-testid="login-button"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-gray-100 border-2 border-gray-300">
            <p className="text-xs font-mono uppercase tracking-wider text-gray-600 mb-2">Demo Credentials</p>
            <p className="text-sm">
              <span className="font-mono">admin@poreview.com</span> / <span className="font-mono">admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
