/**
 * App shell.
 *
 * In Step 1 this file was the foundation status screen. That screen still exists
 * — it moved to pages/SystemStatus.jsx and is served at /status — and App is now
 * just the host for the route table.
 *
 * Providers live in main.jsx rather than here, so this stays a one-line
 * composition point.
 */

import AppRouter from './routes/AppRouter.jsx';

export default function App() {
  return <AppRouter />;
}
