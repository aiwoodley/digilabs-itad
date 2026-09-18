"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Fades in .reveal elements as they enter the viewport, staggered by
// document order. Ported verbatim from the Education site's implementation
// (site/assets/main.js origin) — pure generic UI chrome, no course content.
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".reveal");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach((t) => t.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = (parseInt(el.dataset.revealIndex || "0", 10) % 6) * 90;
            setTimeout(() => el.classList.add("in"), delay);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.15 },
    );

    targets.forEach((t, i) => {
      t.dataset.revealIndex = String(i);
      io.observe(t);
    });

    return () => io.disconnect();
  }, [pathname]);

  return null;
}
