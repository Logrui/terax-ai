import { invoke } from "@tauri-apps/api/core";
import { StarIcon, StarOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type Props = {
  workspaces: string[];
  favoriteWorkspaces: string[];
  preSelectFirst: boolean;
  onSelect: (path: string) => void;
  onDismiss: () => void;
  onToggleFavorite: (path: string) => void;
};

function projectName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function WorkspacePicker({
  workspaces,
  favoriteWorkspaces,
  preSelectFirst,
  onSelect,
  onDismiss,
  onToggleFavorite,
}: Props) {
  const [validFavorites, setValidFavorites] = useState<string[] | null>(null);
  const [validRecents, setValidRecents] = useState<string[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(preSelectFirst ? 0 : -1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function validate() {
      const favSet = new Set(favoriteWorkspaces);
      const allPaths = [
        ...favoriteWorkspaces,
        ...workspaces.filter((p) => !favSet.has(p)),
      ];
      const validFavs: string[] = [];
      const validRecs: string[] = [];
      for (const p of allPaths) {
        try {
          await invoke("fs_stat", { path: p });
          if (favSet.has(p)) validFavs.push(p);
          else validRecs.push(p);
        } catch {
          // path no longer exists -- skip silently
        }
      }
      if (!cancelled) {
        setValidFavorites(validFavs);
        setValidRecents(validRecs);
      }
    }
    void validate();
    return () => {
      cancelled = true;
    };
  }, [workspaces, favoriteWorkspaces]);

  // Focus container for keyboard navigation.
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const allValid = validFavorites !== null && validRecents !== null
    ? [...(validFavorites ?? []), ...(validRecents ?? [])]
    : null;

  // Clamp selection if list shrinks after validation.
  useEffect(() => {
    if (allValid && selectedIndex >= allValid.length) {
      setSelectedIndex(allValid.length > 0 ? 0 : -1);
    }
  }, [allValid, selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!allValid || allValid.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allValid.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allValid.length) {
        onSelect(allValid[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onDismiss();
    }
  }

  const isLoading = validFavorites === null || validRecents === null;
  const isEmpty = !isLoading && (validFavorites?.length ?? 0) === 0 && (validRecents?.length ?? 0) === 0;

  function renderRow(p: string, globalIndex: number, isFavorite: boolean) {
    return (
      <li key={p} className="group">
        <button
          type="button"
          onClick={() => onSelect(p)}
          onMouseEnter={() => setSelectedIndex(globalIndex)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
            globalIndex === selectedIndex
              ? "bg-accent text-accent-foreground"
              : "text-foreground hover:bg-accent/50",
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{projectName(p)}</div>
            <div className="truncate text-xs text-muted-foreground">{p}</div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(p);
            }}
            className={cn(
              "shrink-0 rounded p-0.5 transition-opacity",
              isFavorite
                ? "text-amber-400 opacity-100 hover:text-amber-300"
                : "text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100",
            )}
            title={isFavorite ? "Remove from pinned" : "Pin workspace"}
          >
            <HugeiconsIcon
              icon={isFavorite ? StarIcon : StarOffIcon}
              className={cn("size-3.5", isFavorite && "fill-amber-400")}
              strokeWidth={isFavorite ? 0 : 1.75}
            />
          </button>
        </button>
      </li>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm outline-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="text-sm font-semibold text-foreground">Workspaces</div>

        {isLoading ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Loading...
          </div>
        ) : isEmpty ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No recent workspaces found.
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {(validFavorites?.length ?? 0) > 0 && (
              <>
                <li className="flex items-center gap-1.5 px-1 py-0.5 text-xs font-medium text-muted-foreground">
                  <HugeiconsIcon
                    icon={StarIcon}
                    className="size-3 fill-amber-400 text-amber-400"
                    strokeWidth={0}
                  />
                  Pinned
                </li>
                {validFavorites!.map((p, i) => renderRow(p, i, true))}
              </>
            )}
            {(validFavorites?.length ?? 0) > 0 && (validRecents?.length ?? 0) > 0 && (
              <li className="my-1 border-t border-border" />
            )}
            {(validRecents?.length ?? 0) > 0 && (
              <>
                {(validFavorites?.length ?? 0) > 0 && (
                  <li className="px-1 py-0.5 text-xs font-medium text-muted-foreground">
                    Recent
                  </li>
                )}
                {validRecents!.map((p, i) =>
                  renderRow(p, (validFavorites?.length ?? 0) + i, false),
                )}
              </>
            )}
          </ul>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Skip (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
