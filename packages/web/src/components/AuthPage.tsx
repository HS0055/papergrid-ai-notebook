import React, { useState } from 'react';
import { Book, Sparkles, ArrowRight, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

interface AuthPageProps {
    onLogin: (email: string, password: string) => Promise<void>;
    onSignup: (name: string, email: string, password: string) => Promise<void>;
    onGoogleLogin?: () => Promise<void>;
    error?: string | null;
    loading?: boolean;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin, onSignup, onGoogleLogin, error, loading }) => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const formEmail = (formData.get('email') as string) || email;
        const formPassword = (formData.get('password') as string) || password;

        if (mode === 'login') {
            await onLogin(formEmail, formPassword);
        } else {
            const formName = (formData.get('name') as string) || name;
            await onSignup(formName, formEmail, formPassword);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-400/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Book size={24} className="text-white" />
                        </div>
                        <span className="text-3xl font-bold text-white tracking-tight">PaperGrid</span>
                    </div>
                    <p className="text-indigo-200/60 text-sm">
                        AI-powered digital notebooks that feel real
                    </p>
                </div>

                {/* Auth Card */}
                <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-8">
                    {/* Tab Toggle */}
                    <div className="flex bg-white/5 rounded-xl p-1 mb-6">
                        <button
                            onClick={() => setMode('login')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'login'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                : 'text-white/50 hover:text-white/80'
                                }`}
                        >
                            Log In
                        </button>
                        <button
                            onClick={() => setMode('signup')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'signup'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                : 'text-white/50 hover:text-white/80'
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Google Login */}
                    {onGoogleLogin && (
                        <>
                            <button
                                onClick={onGoogleLogin}
                                disabled={loading}
                                className="w-full py-3 px-4 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                            >
                                <svg width="18" height="18" viewBox="0 0 18 18">
                                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
                                    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                                </svg>
                                Continue with Google
                            </button>

                            <div className="flex items-center gap-4 my-5">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-white/30 text-xs font-medium uppercase tracking-wider">or</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>
                        </>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'signup' && (
                            <div className="relative">
                                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    name="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                    required={mode === 'signup'}
                                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all"
                                />
                            </div>
                        )}

                        <div className="relative">
                            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                            <input
                                name="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email address"
                                required
                                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all"
                            />
                        </div>

                        <div className="relative">
                            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                            <input
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                                minLength={8}
                                className="w-full pl-11 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {mode === 'login' ? 'Log In' : 'Create Account'}
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Features teaser */}
                <div className="mt-8 flex items-center justify-center gap-6 text-white/30 text-xs">
                    <div className="flex items-center gap-1.5">
                        <Sparkles size={12} />
                        <span>AI Layouts</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Book size={12} />
                        <span>16 Block Types</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span>🎵</span>
                        <span>ASMR Sounds</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
