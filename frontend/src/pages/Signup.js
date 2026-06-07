import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LockKey, User, Envelope, Key } from '@phosphor-icons/react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api';

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    inviteCode: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/signup`, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        invite_code: formData.inviteCode
      }, {
        withCredentials: true
      });

      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Signup failed';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <img 
            src="/ambiance-logo.png" 
            alt="Ambiance Sticker" 
            className="h-20 mx-auto mb-4"
          />
          <h1 className="text-3xl font-black text-blue-600 mb-2" style={{ fontFamily: "'Courier New', monospace" }}>
            CREATE ACCOUNT
          </h1>
          <p className="text-sm text-gray-600 font-mono">
            Sign up with your invite code
          </p>
        </div>

        {/* Signup Form */}
        <div className="bg-white border-2 border-blue-600 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div>
              <label className="block text-sm font-mono font-bold text-blue-700 mb-2 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600" size={20} weight="bold" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-blue-600 focus:outline-none focus:border-blue-700 font-mono"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-mono font-bold text-blue-700 mb-2 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Envelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600" size={20} weight="bold" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-blue-600 focus:outline-none focus:border-blue-700 font-mono"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-mono font-bold text-blue-700 mb-2 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <LockKey className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600" size={20} weight="bold" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength="6"
                  className="w-full pl-12 pr-4 py-3 border-2 border-blue-600 focus:outline-none focus:border-blue-700 font-mono"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-mono font-bold text-blue-700 mb-2 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <LockKey className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600" size={20} weight="bold" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength="6"
                  className="w-full pl-12 pr-4 py-3 border-2 border-blue-600 focus:outline-none focus:border-blue-700 font-mono"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Invite Code Field */}
            <div>
              <label className="block text-sm font-mono font-bold text-blue-700 mb-2 uppercase tracking-wider">
                Invite Code
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600" size={20} weight="bold" />
                <input
                  type="text"
                  name="inviteCode"
                  value={formData.inviteCode}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-blue-600 focus:outline-none focus:border-blue-700 font-mono uppercase"
                  placeholder="IMAPPROVER1 or IMADMIN1"
                />
              </div>
              <p className="text-xs text-gray-600 mt-2 font-mono">
                Enter your invite code to create an account
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 font-mono font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-600"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 font-mono">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-bold hover:text-blue-700">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
