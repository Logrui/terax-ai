import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  path: string;
  size: number;
  onOpenSource?: (path: string) => void;
};

type Dims = { w: number; h: number };

const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
const SCALE_STEP = 0.1;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function basename(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

function isSvg(path: string): boolean {
  return path.toLowerCase().endsWith(".svg");
}

export function ImagePane({ path, size, onOpenSource }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [dims, setDims] = useState<Dims | null>(null);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampScale = (s: number) =>
    Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setDims({ w: img.naturalWidth, h: img.naturalHeight });
    },
    [],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setScale((s) => clampScale(s - e.deltaY * 0.001 * s));
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setScale((s) => clampScale(s + SCALE_STEP));
      } else if (e.key === "-") {
        e.preventDefault();
        setScale((s) => clampScale(s - SCALE_STEP));
      } else if (e.key === "0") {
        e.preventDefault();
        setScale(1);
      }
    },
    [],
  );

  useEffect(() => {
    setSrc(null);
    setDims(null);
    setScale(1);
    setError(false);
    invoke<string>("fs_read_image", { path })
      .then(setSrc)
      .catch(() => setError(true));
  }, [path]);

  const name = basename(path);

  return (
    <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 cursor-default items-center justify-center overflow-auto outline-none"
        tabIndex={0}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        style={{
          backgroundImage:
            "linear-gradient(45deg, var(--color-muted) 25%, transparent 25%)," +
            "linear-gradient(-45deg, var(--color-muted) 25%, transparent 25%)," +
            "linear-gradient(45deg, transparent 75%, var(--color-muted) 75%)," +
            "linear-gradient(-45deg, transparent 75%, var(--color-muted) 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          backgroundColor: "var(--color-background)",
        }}
      >
        {error ? (
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="text-sm text-foreground">Failed to load image</div>
            <div className="text-xs text-muted-foreground">{name}</div>
          </div>
        ) : src ? (
          <img
            src={src}
            alt={name}
            draggable={false}
            onLoad={handleLoad}
            onError={() => setError(true)}
            className={cn(
              "block max-w-none select-none transition-none",
              !dims && "opacity-0",
            )}
            style={
              dims
                ? { width: dims.w * scale, height: dims.h * scale }
                : undefined
            }
          />
        ) : null}
      </div>

      <div className="flex h-7 shrink-0 items-center gap-3 border-t border-border/60 bg-card/60 px-3 text-[11px] text-muted-foreground">
        <span className="truncate font-medium text-foreground">{name}</span>
        {dims ? (
          <span className="shrink-0 tabular-nums">
            {dims.w} x {dims.h} px
          </span>
        ) : null}
        <span className="shrink-0 tabular-nums">{formatBytes(size)}</span>
        <span className="shrink-0 tabular-nums opacity-60">
          {Math.round(scale * 100)}%
        </span>
        {isSvg(path) && onOpenSource ? (
          <button
            type="button"
            className="ml-auto shrink-0 rounded px-1.5 py-0.5 hover:bg-accent/60 hover:text-foreground"
            onClick={() => onOpenSource(path)}
          >
            View source
          </button>
        ) : null}
      </div>
    </div>
  );
}
