import type { Metadata } from "next";
import { DropoffForm } from "@/components/forms/DropoffForm";

export const metadata: Metadata = {
  title: "DigiLabs ITAD — Data Destruction & E-Waste Recycling",
  description:
    "NIST 800-88 data destruction and e-waste recycling, processed through R2v3-certified partners. South Florida based, business pickups statewide by arrangement. Call 754-274-6614.",
};

export default function HomePage() {
  return (
    <>
      <section className="hero inverse">
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
          <span className="mono kicker">Data Destruction · E-Waste Recycling · R2v3-Certified Partners</span>
          <h1>Retire your old tech without the data-leak worry.</h1>
          <p className="lead">
            DigiLabs ITAD picks up or accepts drop-offs of retired computers, phones, and office
            equipment across South Florida, and handles business pickups statewide by arrangement.
            We sanitize or destroy data to NIST 800-88 guidelines and hand you a serialized
            Certificate of Destruction for your records. Working devices get refurbished and given
            a second life; everything else goes to our R2v3-certified recycling partner.
          </p>
          <div className="hero-actions">
            <a href="#intake" className="btn btn-primary">Schedule a Pickup or Drop-off</a>
            <a href="tel:7542746614" className="btn btn-outline">📞 Call 754-274-6614</a>
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="section-head">
            <span className="badge green">How it works</span>
            <h2>Three steps and it&apos;s handled</h2>
          </div>
          <div className="grid grid-3">
            <div className="panel">
              <p className="mono mt0">01</p>
              <h3 className="mt0">Tell us what you&apos;ve got</h3>
              <p>Call, text, or use the form below. A laptop or a truckload, home or office, it all counts.</p>
            </div>
            <div className="panel">
              <p className="mono mt0">02</p>
              <h3 className="mt0">We pick it up or you drop it off</h3>
              <p>We confirm a time that works for you. Data-bearing devices get NIST 800-88 destruction with documentation.</p>
            </div>
            <div className="panel">
              <p className="mono mt0">03</p>
              <h3 className="mt0">Your tech gets a second life</h3>
              <p>Working devices are refurbished and resold or donated. Everything else is recycled through our R2v3-certified downstream partner.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="grid grid-2">
            <div>
              <span className="badge">Documented, device by device</span>
              <h2>NIST 800-88 destruction, every time</h2>
              <p className="lead">
                Every data-bearing device we take in goes through Clear, Purge, or Destroy
                sanitization per NIST Special Publication 800-88 — the standard businesses and
                auditors actually ask for. Full chain-of-custody tracking, start to finish.
              </p>
              <p>You get a Certificate of Destruction for your records: proof the job was done right, whether it&apos;s one laptop or a fleet of retired office equipment.</p>
              <a href="/services#itad" className="btn btn-outline">See the Full Process</a>
            </div>
            <div className="panel">
              <h3 className="mt0">Who we serve</h3>
              <p>Homes, offices, and schools across Broward, Miami-Dade, and Palm Beach counties, plus business pickups anywhere in Florida by arrangement.</p>
              <p className="mono form-note">Residential drop-offs · business pickups · recurring commercial service</p>
              <h3>How we&apos;re certified</h3>
              <p className="mb0">DigiLabs ITAD handles pickup, inventory, chain of custody, and NIST 800-88 data sanitization. Final shredding and recycling go through our R2v3-certified downstream partner, and you get their documentation along with ours. DigiLabs itself does not currently hold R2v3 or NAID AAA certification, and we&apos;ll always tell you exactly who handles what.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="intake">
        <div className="wrap">
          <div className="grid grid-2">
            <div>
              <span className="badge green">Schedule now</span>
              <h2>Request a pickup, drop-off, or device donation</h2>
              <p>Tell us what you&apos;ve got and where you&apos;re located. We&apos;ll follow up to confirm timing — or skip the form and just call us.</p>
              <div className="panel" style={{ marginTop: 20 }}>
                <p className="mono mt0">Prefer to talk it through?</p>
                <a href="tel:7542746614" className="btn btn-call btn-block">📞 Call 754-274-6614</a>
                <p className="form-note" style={{ marginTop: 12, marginBottom: 0 }}>
                  We&apos;re happy to walk through data destruction, bulk pickups, or drive
                  logistics on the phone.
                </p>
              </div>
            </div>
            <div className="panel">
              <DropoffForm />
            </div>
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap panel center">
          <h2>Get involved beyond a single drop-off</h2>
          <p style={{ maxWidth: 560, margin: "0 auto 20px" }}>
            Businesses can set up recurring upcycle pickups, and anyone can take the DigiLabs
            pledge to keep tech out of landfills.
          </p>
          <div className="hero-actions center" style={{ justifyContent: "center" }}>
            <a href="/get-involved" className="btn btn-outline">Business Upcycle Partnership</a>
            <a href="/pledge" className="btn btn-primary">Take the Pledge</a>
          </div>
        </div>
      </section>
    </>
  );
}
