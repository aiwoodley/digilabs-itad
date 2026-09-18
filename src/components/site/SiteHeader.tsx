"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Simple horizontal nav — this is a plain marketing site, not subject to the
// Education site's hamburger-only nav requirement.
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/pledge", label: "Pledge" },
  { href: "/get-involved", label: "Get Involved" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site">
      <div className="nav">
        <Link href="/" className="brand">
          <img
            src="/assets/digilabs-icon.png"
            className="brand-mark spin-hover"
            alt="DigiLabs recycling logo"
          />
          <div>
            <div className="brand-name">
              DIGI<span>LABS</span>
            </div>
            <span className="brand-tag">ITAD &amp; E-Waste Recycling</span>
          </div>
        </Link>
        <nav className="links">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : undefined}
            >
              {link.label}
            </Link>
          ))}
          <a href="tel:7542746614" className="nav-cta">
            Call 754-274-6614
          </a>
        </nav>
      </div>
    </header>
  );
}
