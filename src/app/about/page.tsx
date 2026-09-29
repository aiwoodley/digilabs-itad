import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About DigiLabs ITAD",
  description:
    "DigiLabs ITAD provides NIST 800-88 data destruction and e-waste recycling, processed through R2v3-certified partners. South Florida based — part of the broader DigiLabs family.",
};

export default function AboutPage() {
  return (
    <>
      <section className="tight">
        <div className="wrap">
          <span className="mono kicker">About DigiLabs ITAD</span>
          <h1>Documented destruction. Certified recycling partners. No shortcuts.</h1>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="section-head">
            <span className="badge">What we do</span>
            <h2>IT asset disposition, done to a real standard</h2>
          </div>
          <p className="lead" style={{ maxWidth: 720 }}>
            DigiLabs ITAD handles retired technology for homes and businesses across Broward,
            Miami-Dade, and Palm Beach counties, with business pickups statewide by arrangement:
            pickup or drop-off, documented NIST 800-88 data destruction, and recycling of
            everything that can&apos;t be reused through our R2v3-certified downstream partner.
          </p>
          <div className="grid grid-3" style={{ marginTop: 24 }}>
            <div className="panel">
              <h3 className="mt0">NIST 800-88 sanitization</h3>
              <p>Every data-bearing device is sanitized to NIST Special Publication 800-88 standards — Clear, Purge, or Destroy — with full chain-of-custody tracking from intake to disposition.</p>
            </div>
            <div className="panel">
              <h3 className="mt0">Certificate of Destruction</h3>
              <p>Every job ends with a signed Certificate of Destruction: proof of what was destroyed, how, and when, for your compliance records or your own peace of mind.</p>
            </div>
            <div className="panel">
              <h3 className="mt0">Where we work</h3>
              <p>Residential drop-offs and business pickups across Broward, Miami-Dade, and Palm Beach counties, recurring commercial service, and business pickups elsewhere in Florida by arrangement.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="section-head">
            <span className="badge">Certification, plainly</span>
            <h2>Who does what</h2>
          </div>
          <p className="lead" style={{ maxWidth: 720 }}>
            DigiLabs ITAD handles pickup, serialized inventory, chain of custody, and NIST 800-88
            data sanitization. Final shredding and recycling are handled by our R2v3-certified
            downstream partner, and their documentation comes to you along with ours. DigiLabs
            itself does not currently hold R2v3 or NAID AAA certification. If your auditor needs
            partner certificates, just ask.
          </p>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="section-head">
            <span className="badge green">Part of the DigiLabs family</span>
            <h2>One mission, two arms</h2>
          </div>
          <p className="lead" style={{ maxWidth: 720 }}>
            DigiLabs ITAD is the recycling and data-destruction arm of DigiLabs, working alongside{" "}
            <a href="https://digilabs-tech.netlify.app" target="_blank" rel="noreferrer">
              DigiLabs Education
            </a>
            , which teaches students technology skills using real, retired hardware. Different
            sites, different audiences, same underlying commitment: nothing about technology
            should go to waste.
          </p>
        </div>
      </section>

      <section className="tight">
        <div className="wrap panel center">
          <h2>Ready to retire some tech?</h2>
          <p style={{ maxWidth: 520, margin: "0 auto 20px" }}>
            Schedule a pickup or drop-off, or call us directly to talk through data destruction,
            bulk pickups, or recurring commercial service.
          </p>
          <div className="hero-actions center" style={{ justifyContent: "center" }}>
            <a href="/#intake" className="btn btn-primary">Schedule a Pickup</a>
            <a href="tel:7542746614" className="btn btn-outline">📞 Call 754-274-6614</a>
          </div>
        </div>
      </section>
    </>
  );
}
