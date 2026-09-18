import type { Metadata } from "next";
import Link from "next/link";
import { BusinessForm } from "@/components/forms/BusinessForm";

export const metadata: Metadata = {
  title: "Services — DigiLabs ITAD",
  description:
    "Certified data destruction and e-waste recycling for individuals and businesses across Broward, Miami-Dade, and Palm Beach counties.",
};

export default function ServicesPage() {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 20 }}>
        <div className="hero-fx" aria-hidden="true">
          <svg
            className="fx-icon blue"
            style={{ top: "16%", left: "8%", width: 42, animation: "dl-float 7s ease-in-out infinite" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
          >
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
          <svg
            className="fx-icon"
            style={{ top: "64%", right: "12%", width: 48, animation: "dl-float-rev 9s ease-in-out infinite" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M12 3a9 9 0 1 0 9 9" />
            <path d="M17 3l4 0 0 4" />
          </svg>
          <span className="fx-ring" style={{ top: "8%", right: "24%", width: 110, height: 110 }} />
        </div>
        <div className="wrap">
          <span className="mono kicker">ITAD · Recycling</span>
          <h1>What DigiLabs ITAD Offers</h1>
          <p className="lead">
            Certified data destruction and e-waste recycling for individuals and businesses,
            serving Broward, Miami-Dade, and Palm Beach counties.
          </p>
        </div>
      </section>

      <section className="tight">
        <div className="wrap grid grid-2">
          <div className="card reveal">
            <h3>E-Waste Pickup &amp; Drop-off</h3>
            <p>
              Old tech out of your way this week. Call or text 754-274-6614, or book online in
              under two minutes. We pick up from homes, offices, and schools across Broward,
              Miami-Dade, and Palm Beach, or you can drop off directly. Sorted and processed in
              line with Florida DEP requirements.
            </p>
            <div style={{ marginTop: 14 }}>
              <Link href="/#intake" className="btn btn-primary" style={{ marginRight: 8 }}>Book a Pickup Online</Link>
              <a href="sms:7542746614" className="btn btn-outline">Text Us</a>
            </div>
          </div>
          <div className="card reveal">
            <h3 id="itad">ITAD &amp; Certified Data Destruction</h3>
            <p>
              Retire old devices without the &quot;what if our data leaks&quot; worry. We start
              with a tech audit of what you have, destroy data to NIST 800-88 standards with full
              chain-of-custody, and hand you a Certificate of Destruction for your records.
              Devices with life left get wiped and refurbished, then resold or donated, so working
              tech helps someone instead of filling a landfill.
            </p>
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="section-head">
            <span className="badge">The process</span>
            <h2>How certified destruction works</h2>
          </div>
          <div className="grid grid-3">
            <div className="panel">
              <p className="mono mt0">Step 1</p>
              <h3 className="mt0">Tech audit</h3>
              <p>We log every device — make, model, serial number — before anything is touched, so there&apos;s a clean paper trail from intake to disposition.</p>
            </div>
            <div className="panel">
              <p className="mono mt0">Step 2</p>
              <h3 className="mt0">NIST 800-88 sanitization</h3>
              <p>Clear, Purge, or Destroy — whichever the device and your risk profile call for — with chain-of-custody documentation the whole way through.</p>
            </div>
            <div className="panel">
              <p className="mono mt0">Step 3</p>
              <h3 className="mt0">Certificate of Destruction</h3>
              <p>You receive a signed Certificate of Destruction confirming what was destroyed, how, and when — your record for compliance or peace of mind.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap panel">
          <div className="grid grid-2">
            <div>
              <span className="badge">Free download</span>
              <h3>How to Responsibly Dispose of E-Waste</h3>
              <p>A short, practical guide: what counts as e-waste, how to protect your data before you let a device go, and where it should end up. No sign-up required.</p>
              <a href="/assets/digilabs-ewaste-disposal-guide.pdf" className="btn btn-primary" download>
                Download the Guide (PDF)
              </a>
            </div>
            <div>
              <span className="badge">Every device counts</span>
              <h3>Residential &amp; commercial, any volume</h3>
              <p>One old laptop from a closet or a warehouse of retired office equipment — the process is the same either way, and every device gets the same documentation.</p>
              <a href="/get-involved#business" className="btn btn-outline">Set Up Business Pickups</a>
            </div>
          </div>
        </div>
      </section>

      <section id="business-services">
        <div className="wrap">
          <div className="grid grid-2">
            <div>
              <span className="badge green">For businesses</span>
              <h2>Set up recurring collection</h2>
              <p>Tell us about your business, what you have on hand, and how often you need pickups. We&apos;ll follow up to schedule a walkthrough and get a recurring collection set up — with full data destruction documentation for every device.</p>
              <div className="panel" style={{ marginTop: 20 }}>
                <p className="mono mt0">Rather talk it through directly?</p>
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
