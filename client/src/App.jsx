import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout.jsx';
import Dashboard from './Dashboard.jsx';
import EntryForm from './EntryForm.jsx';
import History from './History.jsx';
import ScorecardAdmin from './ScorecardAdmin.jsx';
import Login from './Login.jsx';

export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem('cc_auth') === '1');

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/scorecards/directors/dashboard" replace />} />
          <Route path="scorecards/:scorecardId/dashboard" element={<Dashboard />} />
          <Route path="scorecards/:scorecardId/entry"     element={<EntryForm />} />
          <Route path="scorecards/:scorecardId/history"   element={<History />} />
          <Route path="admin" element={<ScorecardAdmin />} />
        </Route>
      </Routes>
    </Router>
  );
}
