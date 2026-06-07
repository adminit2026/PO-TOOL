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
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-900 to-blue-700 items-center justify-center p-12">
        <div className="text-center">
          <img src="/ambiance-logo.png" alt="Ambiance Sticker" className="mx-auto mb-8 w-64 drop-shadow-2xl" />
          <h1 className="text-5xl font-bold mb-4 text-white">
            Purchase Order System
          </h1>
          <p className="text-xl text-blue-100">Production Cost Analysis & Management</p>
          <div className="mt-8 flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">24/7</div>
              <div className="text-sm text-blue-200">Access</div>
            </div>
            <div className="h-12 w-px bg-blue-400"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">Real-time</div>
              <div className="text-sm text-blue-200">Analysis</div>
            </div>
            <div className="h-12 w-px bg-blue-400"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">Smart</div>
              <div className="text-sm text-blue-200">Approval</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2 text-gray-900" data-testid="login-title">
              Sign In
            </h2>
            <p className="text-sm text-gray-600">Enter your credentials to access the system</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded" data-testid="login-error">
              <div className="flex items-start gap-3">
                <Warning size={20} weight="fill" className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base transition-all"
                placeholder="your.email@company.com"
                data-testid="email-input"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base pr-12 transition-all"
                  placeholder="Enter your password"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              data-testid="login-button"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>&copy; 2026 Ambiance Sticker. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
