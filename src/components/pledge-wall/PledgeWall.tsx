"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Pledge {
  display_name: string;
  school_name: string | null;
  city: string | null;
  state: string | null;
  pledge_recycle: boolean;
  pledge_educate: boolean;
  pledge_reduce: boolean;
  pledge_advocate: boolean;
  pledge_message: string | null;
}

export function PledgeWall() {
  const [pledges, setPledges] = useState<Pledge[] | null>(null);

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("student_pledges")
      .select(
        "display_name, school_name, city, state, pledge_recycle, pledge_educate, pledge_reduce, pledge_advocate, pledge_message",
      )
      .eq("show_on_wall", true)
      .eq("verified", true)
      .order("pledge_number", { ascending: true });

    if (error || !data) {
      setPledges([]);
      return;
    }
    setPledges(data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  if (pledges === null) {
    return (
      <div className="wall" id="pledge-wall">
        <p className="wall-empty">Loading pledges…</p>
      </div>
    );
  }

  if (pledges.length === 0) {
    return (
      <div className="wall" id="pledge-wall">
        <p className="wall-empty">Be the first pledge to appear on this wall — submit yours above.</p>
      </div>
    );
  }

  return (
    <div className="wall" id="pledge-wall">
      {pledges.map((p, i) => {
        const tags = [
          p.pledge_recycle && "Recycle",
          p.pledge_educate && "Educate",
          p.pledge_reduce && "Reduce",
          p.pledge_advocate && "Advocate",
        ].filter(Boolean) as string[];
        const meta = [p.school_name, p.city, p.state].filter(Boolean).join(" · ");
        return (
          <div className="wall-card" key={`${p.display_name}-${i}`}>
            <div className="name">{p.display_name}</div>
            <div className="meta">{meta}</div>
            <div className="wall-tags">
              {tags.map((t) => (
                <span className="wall-tag" key={t}>{t}</span>
              ))}
            </div>
            {p.pledge_message && (
              <p style={{ marginTop: 10, fontSize: "0.88rem" }}>&quot;{p.pledge_message}&quot;</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
