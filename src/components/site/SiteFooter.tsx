export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer>
      <div className="wrap">
        <div className="cols">
          <div>
            <div className="brand" style={{ marginBottom: 10 }}>
              <img
                src="/assets/digilabs-icon.png"
                className="brand-mark spin-hover"
                alt="DigiLabs logo"
              />
              <div className="brand-name">
                DIGI<span>LABS</span>
              </div>
            </div>
            <p style={{ maxWidth: 300 }}>ITAD &amp; E-Waste Recycling.</p>
            <p className="form-note" style={{ maxWidth: 300 }}>
              NIST 800-88 certified data destruction and e-waste recycling across Broward,
              Miami-Dade and Palm Beach counties. Part of the DigiLabs family, alongside{" "}
              <a href="https://digilabs-tech.netlify.app" target="_blank" rel="noreferrer">
                DigiLabs Education
              </a>
              .
            </p>
          </div>
          <div>
            <h4>Recycle</h4>
            <p>
              <a href="/services">E-Waste Pickup</a>
              <br />
              <a href="/services#itad">ITAD &amp; Data Destruction</a>
              <br />
              <a href="/#intake">Schedule a Pickup</a>
            </p>
          </div>
          <div>
            <h4>Get Involved</h4>
            <p>
              <a href="/pledge">The Pledge</a>
              <br />
              <a href="/get-involved">Business Partnerships</a>
              <br />
              <a href="/get-involved#business">Upcycle Program</a>
            </p>
          </div>
          <div>
            <h4>Company</h4>
            <p>
              <a href="/about">About DigiLabs ITAD</a>
              <br />
              <a href="tel:7542746614">754-274-6614</a>
              <br />
              <a href="mailto:admin@digi-labs.org">admin@digi-labs.org</a>
            </p>
          </div>
        </div>
        <p className="fine">© {year} DigiLabs ITAD. Certified data destruction &amp; e-waste recycling.</p>
      </div>
    </footer>
  );
}
