import type { Metadata } from "next";
import { PledgeForm } from "@/components/forms/PledgeForm";
import { PledgeWall } from "@/components/pledge-wall/PledgeWall";

export const metadata: Metadata = {
  title: "The DigiLabs Pledge — Reclaim. Rebuild. Reimagine.",
  description:
    "Take the DigiLabs pledge to recycle, educate, reduce, and advocate — and see everyone who's already signed on.",
};

export default function PledgePage() {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 20 }}>
        <div className="hero-fx" aria-hidden="true">
          <svg
            className="fx-icon"
            style={{ top: "14%", left: "7%", width: 40, animation: "dl-float 7.5s ease-in-out infinite" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
          >
            <path d="M12 3l3 3-3 3M12 21l-3-3 3-3M4 16l3-3M20 8l-3 3M7 19H5.5A2.5 2.5 0 0 1 3 16.5V16a2 2 0 0 1 2-2h.5M17 5h1.5A2.5 2.5 0 0 1 21 7.5V8a2 2 0 0 1-2 2h-.5" />
          </svg>
          <svg
            className="fx-icon blue"
            style={{ top: "66%", right: "10%", width: 44, animation: "dl-float-rev 8s ease-in-out infinite" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
          >
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
          </svg>
          <span className="fx-ring" style={{ top: "10%", right: "20%", width: 100, height: 100 }} />
        </div>
        <div className="wrap">
          <span className="mono kicker">Recycle · Educate · Reduce · Advocate</span>
          <h1>Take the DigiLabs Pledge</h1>
          <p className="lead">
            A public commitment to keep tech out of landfills and put it to work for your
            community. Students, educators, businesses, and neighbors are all welcome to sign on.
          </p>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="grid grid-2">
            <div className="panel">
              <h3 className="mt0">Sign the pledge</h3>
              <PledgeForm />
            </div>

            <div>
              <h3 className="mt0">The Pledge Wall</h3>
              <p>Everyone who has signed on so far.</p>
              <PledgeWall />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
