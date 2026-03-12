import { useState } from 'react';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem('cc_auth', '1');
        onLogin();
      } else {
        setError('Incorrect password. Try again.');
      }
    } catch {
      setError('Could not reach server. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ backgroundColor: '#2F2F8F' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.png"
            alt="ChurchCandy Marketing"
            className="mb-2"
            style={{ maxWidth: '220px', height: 'auto' }}
          />
          <p className="text-slate-400 text-sm">Scorecards</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Team Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': '#2F2F8F' }}
              onFocus={e => e.target.style.borderColor = '#2F2F8F'}
              onBlur={e => e.target.style.borderColor = ''}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 text-white font-medium rounded-lg text-sm
                       transition-colors disabled:opacity-50"
            style={{ backgroundColor: loading || !password ? '#9999CC' : '#2F2F8F' }}
            onMouseEnter={e => { if (!loading && password) e.target.style.backgroundColor = '#22226B'; }}
            onMouseLeave={e => { if (!loading && password) e.target.style.backgroundColor = '#2F2F8F'; }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
