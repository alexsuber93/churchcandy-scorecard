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
      <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
              CC
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">ChurchCandy</p>
              <p className="text-slate-400 text-xs mt-0.5">Scorecards</p>
            </div>
          </div>
        </div>

        {/* Scorecard list */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {scorecards.map(sc => {
            const isActive = sc.id === activeScorecardId;
            return (
              <div key={sc.id}>
                <NavLink
                  to={`/scorecards/${sc.id}/dashboard`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
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
        <div className="px-3 py-4 border-t border-slate-700">
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <Settings size={15} />
            Manage Scorecards
          </NavLink>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
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
            ? 'bg-indigo-600 text-white'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
        }`
      }
    >
      <Icon size={13} />
      {label}
    </NavLink>
  );
}
