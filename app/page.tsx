// The authenticated application's dashboard/home. `/` is gated by middleware.ts -- an
// unauthenticated visitor is redirected to /auth/login before this component ever renders, so
// everything here can assume a real session exists. (The previous version of this page rendered a
// public marketing/research-showcase landing view by default, with a client-side toggle to this
// dashboard -- that content now lives at the public /about route; see that file's header comment.)
import LiveDashboardContent from './components/dashboard/LiveDashboardContent';

export default function OverviewPage() {
  return <LiveDashboardContent />;
}
