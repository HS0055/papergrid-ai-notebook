import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'papergrid_session';

type Plan = 'free' | 'starter' | 'pro' | 'founder' | 'creator';
type Role = 'user' | 'admin';

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  plan: Plan;
  role?: Role;
  aiGenerationsUsed?: number;
  aiGenerationsResetAt?: string;
  inkSubscription?: number;
  inkPurchased?: number;
  inkResetAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  _creationTime: number;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(SESSION_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const PLANS: Plan[] = ['free', 'starter', 'pro', 'founder', 'creator'];
const PLAN_COLORS: Record<Plan, string> = {
  free: 'bg-gray-100 text-gray-700',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  founder: 'bg-amber-100 text-amber-700',
  creator: 'bg-emerald-100 text-emerald-700',
};

export function AdminPanel() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/admin/users`, { headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    fetchUsers();
  }, [isAuthenticated, navigate, fetchUsers]);

  const setPlan = async (targetUserId: string, plan: Plan) => {
    setActionLoading(targetUserId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/set-plan`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ targetUserId, plan }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      setUsers(prev => prev.map(u => u._id === targetUserId ? { ...u, plan } : u));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update plan');
    } finally {
      setActionLoading(null);
    }
  };

  const setRole = async (targetUserId: string, role: Role) => {
    setActionLoading(targetUserId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/set-role`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ targetUserId, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      setUsers(prev => prev.map(u => u._id === targetUserId ? { ...u, role } : u));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  const resetUsage = async (targetUserId: string) => {
    setActionLoading(targetUserId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reset-usage`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      setUsers(prev => prev.map(u =>
        u._id === targetUserId ? { ...u, aiGenerationsUsed: 0, aiGenerationsResetAt: new Date().toISOString() } : u
      ));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to reset usage');
    } finally {
      setActionLoading(null);
    }
  };

  const grantInk = async (targetUserId: string) => {
    const input = window.prompt('Enter Ink amount to grant:');
    if (!input) return;
    const amount = parseInt(input, 10);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive number.');
      return;
    }
    setActionLoading(targetUserId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/grant-ink`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ targetUserId, amount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      const data = await res.json();
      setUsers(prev => prev.map(u =>
        u._id === targetUserId
          ? { ...u, inkPurchased: data.inkPurchased ?? (u.inkPurchased ?? 0) + amount }
          : u
      ));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to grant Ink');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-md text-center">
          <div className="text-red-500 text-lg font-medium mb-2">Access Denied</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/app')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/app')}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {users.length} users
            </span>
          </div>
          <button
            onClick={fetchUsers}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Stats summary */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {PLANS.map(plan => {
            const count = users.filter(u => u.plan === plan).length;
            return (
              <div key={plan} className="bg-white rounded-xl border p-4">
                <div className="text-sm text-gray-500 capitalize">{plan}</div>
                <div className="text-2xl font-bold text-gray-900">{count}</div>
              </div>
            );
          })}
        </div>

        {/* Ink Economy */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Ink Economy</h2>
            <button
              onClick={() => alert('Coming soon: edit via /api/admin/ink-config')}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors"
            >
              Edit
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* Plan Ink Allocations */}
            <div className="bg-white rounded-xl border p-3">
              <div className="text-xs text-gray-500 mb-1">Free Plan</div>
              <div className="text-lg font-bold text-gray-900">12</div>
              <div className="text-xs text-gray-400">Ink / month</div>
            </div>
            <div className="bg-white rounded-xl border p-3">
              <div className="text-xs text-gray-500 mb-1">Pro Plan</div>
              <div className="text-lg font-bold text-purple-700">120</div>
              <div className="text-xs text-gray-400">Ink / month</div>
            </div>
            <div className="bg-white rounded-xl border p-3">
              <div className="text-xs text-gray-500 mb-1">Creator Plan</div>
              <div className="text-lg font-bold text-emerald-700">350</div>
              <div className="text-xs text-gray-400">Ink / month</div>
            </div>
            {/* Action Costs */}
            <div className="bg-white rounded-xl border p-3">
              <div className="text-xs text-gray-500 mb-1">Layout</div>
              <div className="text-lg font-bold text-gray-900">1</div>
              <div className="text-xs text-gray-400">Ink / action</div>
            </div>
            <div className="bg-white rounded-xl border p-3">
              <div className="text-xs text-gray-500 mb-1">Advanced</div>
              <div className="text-lg font-bold text-gray-900">2</div>
              <div className="text-xs text-gray-400">Ink / action</div>
            </div>
            <div className="bg-white rounded-xl border p-3">
              <div className="text-xs text-gray-500 mb-1">Cover</div>
              <div className="text-lg font-bold text-gray-900">4</div>
              <div className="text-xs text-gray-400">Ink / action</div>
            </div>
            <div className="bg-white rounded-xl border p-3">
              <div className="text-xs text-gray-500 mb-1">Premium Cover</div>
              <div className="text-lg font-bold text-gray-900">6</div>
              <div className="text-xs text-gray-400">Ink / action</div>
            </div>
          </div>
        </div>

        {/* Users table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ink Balance</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isCurrentUser = u._id === (user as any)?._id || u.email === user?.email;
                  const isProcessing = actionLoading === u._id;
                  return (
                    <tr key={u._id} className={`border-b last:border-0 ${isCurrentUser ? 'bg-indigo-50/30' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{u.name}</div>
                        <div className="text-gray-500 text-xs">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.plan}
                          disabled={isProcessing}
                          onChange={(e) => setPlan(u._id, e.target.value as Plan)}
                          className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${PLAN_COLORS[u.plan]}`}
                        >
                          {PLANS.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role || 'user'}
                          disabled={isProcessing}
                          onChange={(e) => setRole(u._id, e.target.value as Role)}
                          className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${
                            u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const sub = u.inkSubscription ?? 0;
                          const purch = u.inkPurchased ?? 0;
                          const total = sub + purch;
                          return (
                            <div className="flex items-center gap-2">
                              <span
                                className="text-gray-900 font-medium cursor-help"
                                title={`${sub} monthly + ${purch} purchased`}
                              >
                                {total} Ink
                              </span>
                              <button
                                onClick={() => grantInk(u._id)}
                                disabled={isProcessing}
                                className="text-xs text-emerald-600 hover:text-emerald-700 disabled:text-gray-300 disabled:cursor-not-allowed font-medium"
                                title="Grant Ink to user"
                              >
                                Grant
                              </button>
                              {/* TODO: Add Deduct button calling POST /api/admin/deduct-ink */}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(u._creationTime).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isProcessing && (
                          <div className="inline-block w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
