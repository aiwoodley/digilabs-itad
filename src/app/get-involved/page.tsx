import type { Metadata } from "next";
import Link from "next/link";
import { BusinessForm } from "@/components/forms/BusinessForm";

export const metadata: Metadata = {
  title: "Get Involved — DigiLabs ITAD",
  description: "Donate technology, partner with DigiLabs ITAD to upcycle your business's e-waste, or take the pledge.",
};

export default function GetInvolvedPage() {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 20 }}>
        <div className="hero-fx" aria-hidden="true">
          <svg
            className="fx-icon"
            style={{ top: "15%", left: "9%", width: 44, animation: "dl-float 7.8s ease-in-out infinite" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
          >
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
          </svg>
          <svg
            className="fx-icon blue"
            style={{ top: "62%", right: "11%", width: 38, animation: "dl-float-rev 8.4s ease-in-out infinite" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
          >
            <path d="M12 3l3 3-3 3M12 21l-3-3 3-3M4 16l3-3M20 8l-3 3M7 19H5.5A2.5 2.5 0 0 1 3 16.5V16a2 2 0 0 1 2-2h.5M17 5h1.5A2.5 2.5 0 0 1 21 7.5V8a2 2 0 0 1-2 2h-.5" />
          </svg>
          <span className="fx-ring" style={{ top: "10%", right: "22%", width: 100, height: 100 }} />
        </div>
        <div className="wrap">
          <span className="mono kicker">Donate · Partner · Pledge</span>
          <h1>Get Involved</h1>
          <p className="lead">
            Whether you&apos;ve got one old laptop or a warehouse of retired equipment, there&apos;s
            a path here for you.
          </p>
        </div>
      </section>

      <section className="tight">
        <div className="wrap grid grid-3">
          <div className="card reveal">
            <h3>Donate Technology</h3>
            <p>Have a device to donate? Use the pickup/drop-off form on our home page, or call us and we&apos;ll take care of the rest.</p>
            <Link href="/#intake" className="btn btn-outline btn-block">Donate a Device</Link>
          </div>
          <div className="card reveal">
            <div className="icon">🤝</div>
            <h3>Business Upcycle Partnership</h3>
            <p>Set up recurring collection for your business&apos;s retired equipment — desktops, laptops, monitors, servers, and more.</p>
            <a href="#business" className="btn btn-outline btn-block">Partner With Us</a>
          </div>
          <div className="card reveal">
            <div className="icon">✊</div>
            <h3>Take the Pledge</h3>
            <p>Publicly commit to recycling, educating, reducing, and advocating — and see who else has already signed on.</p>
            <a href="/pledge" className="btn btn-outline btn-block">Sign the Pledge</a>
          </div>
        </div>
      </section>

      <section id="business">
        <div className="wrap">
          <div className="grid grid-2">
            <div>
              <span className="badge green">For businesses</span>
              <h2>Upcycle your retired equipment with us</h2>
              <p>Tell us about your business, what you have on hand, and how often you need pickups. We&apos;ll follow up to schedule a walkthrough and get a recurring collection set up — with full data destruction documentation for every device.</p>
              <div className="panel" style={{ marginTop: 20 }}>
                <p className="mono mt0">Prefer to talk it through?</p>
                <a href="tel:7542746614" className="btn btn-call btn-block">📞 Call 754-274-6614</a>
              </div>
            </div>
            <div className="panel">
              <BusinessForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
