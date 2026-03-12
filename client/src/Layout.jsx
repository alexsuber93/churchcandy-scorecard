import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, PlusCircle, History, Settings } from 'lucide-react';

export default function Layout() {
  const [scorecards, setScorecards] = useState([]);
  const location = useLocation();
  const match = location.pathname.match(/^\/scorecards\/([^/]+)/);
  const activeScorecardId = match?.[1];

  useEffect(() => {
    fetch('/api/scorecards')
      .then(r => r.json())
      .then(setScorecards)
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#2F2F8F' }}>
        {/* Logo */}
        <div className="px-5 py-5 flex items-center justify-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <img
            src="/logo.png"
            alt="ChurchCandy Marketing"
            className="w-full"
            style={{ maxHeight: '48px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
        </div>

        {/* Scorecard list */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {scorecards.map(sc => {
            const isActive = sc.id === activeScorecardId;
            return (
              <div key={sc.id}>
                <NavLink
                  to={`/scorecards/${sc.id}/dashboard`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={isActive
                    ? { backgroundColor: 'rgba(255,255,255,0.18)', color: '#ffffff' }
                    : { color: 'rgba(255,255,255,0.65)' }
                  }
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sc.color }}
                  />
                  {sc.name}
                </NavLink>

                {/* Sub-nav when this scorecard is active */}
                {isActive && (
                  <div className="ml-5 mt-0.5 space-y-0.5 mb-1">
                    <SubNavLink to={`/scorecards/${sc.id}/dashboard`} icon={LayoutDashboard} label="Dashboard" />
                    <SubNavLink to={`/scorecards/${sc.id}/entry`}     icon={PlusCircle}       label="Enter Numbers" />
                    <SubNavLink to={`/scorecards/${sc.id}/history`}   icon={History}          label="History" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom: Manage Scorecards */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <NavLink
            to="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Settings size={15} />
            Manage Scorecards
          </NavLink>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-cc-gray">
        <Outlet />
      </main>
    </div>
  );
}

function SubNavLink({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          isActive
            ? 'text-white'
            : 'hover:text-white'
        }`
      }
      style={({ isActive }) => isActive
        ? { backgroundColor: '#FF7A1A' }
        : { color: 'rgba(255,255,255,0.5)' }
      }
    >
      <Icon size={13} />
      {label}
    </NavLink>
  );
}
