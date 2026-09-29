"use client";

import { useEffect, useRef, useState } from "react";

// Finger/mouse signature pad. Returns a PNG blob via onDone.
export function SignaturePad({ onDone, onCancel, label }: { onDone: (png: Blob) => void; onCancel: () => void; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0a2a5c";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    ref.current!.setPointerCapture(e.pointerId);
    const ctx = ref.current!.getContext("2d")!;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const [x, y] = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setEmpty(false);
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  return (
    <div className="sig-wrap">
      <p className="mono mt0">{label}</p>
      <canvas ref={ref} className="sig-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      <div className="adm-actions">
        <button type="button" className="btn btn-outline" onClick={clear}>Clear</button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={empty}
          onClick={() => ref.current!.toBlob((b) => b && onDone(b), "image/png")}>Save signature</button>
      </div>
    </div>
  );
}
