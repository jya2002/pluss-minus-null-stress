import { Component, lazy } from "react";
import type { ReactNode } from "react";
import { Link, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import { Empty } from "./components/ui";
const Events = lazy(() => import("./pages/Events"));
const EventDetail = lazy(() =>
  import("./pages/Events").then((m) => ({ default: m.EventDetail })),
);
const Thursday = lazy(() => import("./pages/Thursday"));
const Auth = lazy(() => import("./pages/Auth"));
const Account = lazy(() => import("./pages/Account"));
const About = lazy(() =>
  import("./pages/Info").then((m) => ({ default: m.About })),
);
const Privacy = lazy(() =>
  import("./pages/Info").then((m) => ({ default: m.Privacy })),
);
const Admin = lazy(() => import("./pages/Admin"));
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="container page">
        <h1>En uventet feil oppstod.</h1>
        <p>Last siden på nytt for å prøve igjen.</p>
        <button className="button" onClick={() => window.location.reload()}>
          Last inn på nytt
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="arrangementer" element={<Events />} />
          <Route path="arrangementer/:id" element={<EventDetail />} />
          <Route path="torsdagsbanken" element={<Thursday />} />
          <Route path="logg-inn" element={<Auth />} />
          <Route path="min-side" element={<Account />} />
          <Route path="om" element={<About />} />
          <Route path="personvern" element={<Privacy />} />
          <Route path="admin" element={<Admin />} />
          <Route
            path="*"
            element={
              <div className="container page">
                <Empty title="Her var det tomt">
                  <Link to="/">Til forsiden →</Link>
                </Empty>
              </div>
            }
          />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
