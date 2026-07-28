"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { ChevronRight, Download } from "lucide-react";

type Props = {
  disabled?: boolean;
  busy?: boolean;
  onConfirm: () => void;
};

const THRESHOLD = 0.88;

export function IngestSlider({ disabled = false, busy = false, onConfirm }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const confirmed = useRef(false);
  const startX = useRef(0);
  const startProgress = useRef(0);
  const [progress, setProgress] = useState(0);
  const [maxTravel, setMaxTravel] = useState(120);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const thumb = 36; // size-9
    const pad = 4; // left-1
    setMaxTravel(Math.max(0, track.clientWidth - thumb - pad * 2));
  }, []);

  useEffect(() => {
    measure();
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    if (!busy) {
      confirmed.current = false;
      setProgress(0);
    }
  }, [busy]);

  function confirm() {
    if (disabled || busy || confirmed.current) return;
    confirmed.current = true;
    setProgress(1);
    onConfirm();
  }

  function setFromClientX(clientX: number) {
    const delta = clientX - startX.current;
    const next = Math.min(
      1,
      Math.max(0, startProgress.current + delta / Math.max(maxTravel, 1)),
    );
    setProgress(next);
    return next;
  }

  function finish(next: number) {
    dragging.current = false;
    if (next >= THRESHOLD) {
      confirm();
      return;
    }
    setProgress(0);
  }

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (disabled || busy) return;
    dragging.current = true;
    startX.current = e.clientX;
    startProgress.current = progress;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    if (!dragging.current) return;
    setFromClientX(e.clientX);
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    if (!dragging.current) return;
    finish(setFromClientX(e.clientX));
  }

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (disabled || busy || confirmed.current) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 1) return;
    e.preventDefault();
    const next = Math.min(1, Math.max(0, progress + delta / Math.max(maxTravel, 1)));
    setProgress(next);
    if (next >= THRESHOLD) confirm();
  }

  const x = progress * maxTravel;
  const labelOpacity = Math.max(0, 1 - progress * 1.4);

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Slide right to ingest"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-disabled={disabled || busy}
      tabIndex={disabled || busy ? -1 : 0}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (disabled || busy) return;
        if (e.key === "ArrowRight" || e.key === "End") {
          e.preventDefault();
          confirm();
        }
        if (e.key === "ArrowLeft" || e.key === "Home" || e.key === "Escape") {
          e.preventDefault();
          setProgress(0);
        }
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragging.current = false;
        setProgress(0);
      }}
      className="relative h-11 min-w-0 flex-1 touch-none select-none overflow-hidden rounded-full border border-border bg-muted/70 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled || busy ? "not-allowed" : "grab",
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary/20 transition-[width] duration-75"
        style={{ width: `${Math.max(40, x + 40)}px` }}
      />

      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-sm font-medium text-foreground"
        style={{ opacity: labelOpacity }}
      >
        <Download className="size-4" />
        <span>{busy ? "…" : "Ingest"}</span>
        <ChevronRight className="size-4 opacity-55" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-1 z-10 aspect-square rounded-full border border-border bg-background text-foreground shadow-sm"
        style={{
          transform: `translateX(${x}px)`,
          transition: dragging.current ? "none" : "transform 180ms ease-out",
        }}
      >
        <div className="flex size-full items-center justify-center">
          <ChevronRight className="size-4" />
        </div>
      </div>
    </div>
  );
}
