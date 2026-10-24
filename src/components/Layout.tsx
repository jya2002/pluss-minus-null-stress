import { Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X, Camera, Mail, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, demo } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Failure, Loading } from "./ui";
import BrandMark from "./BrandMark";
export function Logo() {
  return (
    <Link
      to="/"
      className="logo"
      aria-label="Pluss Minus Null Stress – forsiden"
    >
      <BrandMark />
      <span className="logo-type">
        Pluss Minus
        <br />
        Null Stress
      </span>
    </Link>
  );
}
export default function Layout() {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const { session, role, authError } = useAuth();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const open = openFor === location.key;
  const previousPath = useRef(location.pathname);
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (previousPath.current !== location.pathname) {
      main.current?.focus();
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);
  return (
    <>
      <a
        href="#main"
        className="skip"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Hopp til innhold
      </a>
      <header className="header">
        <div className="container nav-wrap">
          <Logo />
          <Link className="button primary nav-join" to="/min-side">
            Bli med
          </Link>
          <button
            className="icon-button mobile-toggle"
            aria-label={open ? "Lukk meny" : "Åpne meny"}
            aria-expanded={open}
            aria-controls="navigation"
            onClick={() => setOpenFor(open ? null : location.key)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            id="navigation"
            className={open ? "nav open" : "nav"}
            aria-label="Hovedmeny"
          >
            <NavLink to="/" end>
              Hjem
            </NavLink>
            <NavLink to="/arrangementer">Arrangementer</NavLink>
            <NavLink to="/torsdagsbanken">
              Torsdagsbanken <span className="nav-dot" />
            </NavLink>
            <NavLink to="/om">Om oss</NavLink>
            {session && role !== "student" && (
              <NavLink to="/admin">Styreportal</NavLink>
            )}
            <NavLink
              to={session ? "/min-side" : "/logg-inn"}
              className="nav-login"
            >
              <UserRound size={17} />
              {session ? "Min side" : "Logg inn"}
              <ArrowUpRight size={16} />
            </NavLink>
          </nav>
        </div>
      </header>
      {demo && (
        <div className="demo-bar">
          Demovisning · Eksempelinnhold, ingen reelle påmeldinger. Quiz &amp;
          Kaos er et utkast.
        </div>
      )}
      <main id="main" ref={main} tabIndex={-1}>
        {authError && (
          <div className="container">
            <Failure error={authError} retry={() => window.location.reload()} />
          </div>
        )}
        <Suspense
          fallback={
            <div className="container page">
              <Loading />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <footer>
        <div className="container footer-grid">
          <div>
            <Logo />
            <p>
              Et fellesskap som går opp.
              <br />
              For deg som vil ha litt mer enn pensum.
            </p>
            <div className="socials">
              {settings.data?.instagram_url && (
                <a
                  href={settings.data.instagram_url}
                  aria-label="Instagram"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Camera size={20} />
                </a>
              )}
              {settings.data?.facebook_url && (
                <a
                  href={settings.data.facebook_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook <ArrowUpRight size={16} />
                </a>
              )}
              {settings.data?.contact_email && (
                <a
                  href={`mailto:${settings.data.contact_email}`}
                  aria-label="Send e-post"
                >
                  <Mail size={20} />
                </a>
              )}
            </div>
          </div>
          <div>
            <h3>Finn din plass</h3>
            <Link to="/arrangementer">Arrangementer</Link>
            <Link to="/torsdagsbanken">Torsdagsbanken</Link>
            <Link to="/min-side">Bli medlem</Link>
          </div>
          <div>
            <h3>Foreningen</h3>
            <Link to="/om">Om oss og kontakt</Link>
            <Link to="/personvern">Personvern</Link>
            <Link to="/admin">For styret</Link>
          </div>
          <div className="footer-note">
            <span className="eyebrow">UNIVERSITETET I OSLO</span>
            <p>
              Matematikk + mennesker
              <br />= mindre stress.
            </p>
            <span className="math-mini" aria-hidden="true">
              + − 0
            </span>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Pluss Minus Null Stress</span>
          <span>Laget for fellesskapet. Med litt matematikk.</span>
        </div>
      </footer>
    </>
  );
}
