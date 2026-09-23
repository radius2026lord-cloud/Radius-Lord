"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CollectionViewMode } from "@/components/ui/collection-view-toggle";

type StoredCollectionState = {
  view?: CollectionViewMode;
  selected?: Array<string | number>;
  selectionMode?: boolean;
};

export function useCollectionState<T extends string | number>(key: string, defaultView: CollectionViewMode = "row") {
  const storageKey = `lord-radius-collection:${key}`;
  const [hydrated, setHydrated] = useState(false);
  const [view, setViewState] = useState<CollectionViewMode>(defaultView);
  const [selected, setSelected] = useState<Set<T>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as StoredCollectionState;
        if (saved.view === "grid" || saved.view === "row") setViewState(saved.view);
        if (Array.isArray(saved.selected)) setSelected(new Set(saved.selected as T[]));
        if (typeof saved.selectionMode === "boolean") setSelectionMode(saved.selectionMode);
      }
    } catch {}
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    const state: StoredCollectionState = { view, selected: Array.from(selected), selectionMode };
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [hydrated, selectionMode, selected, storageKey, view]);

  const setView = useCallback((next: CollectionViewMode) => setViewState(next), []);
  const toggle = useCallback((id: T) => setSelected((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }), []);
  const clear = useCallback(() => setSelected(new Set()), []);
  const setAll = useCallback((ids: T[], checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    ids.forEach((id) => checked ? next.add(id) : next.delete(id));
    return next;
  }), []);

  return useMemo(() => ({ view, setView, selected, setSelected, selectionMode, setSelectionMode, toggle, clear, setAll, hydrated }), [clear, hydrated, selectionMode, selected, setAll, setView, toggle, view]);
}
