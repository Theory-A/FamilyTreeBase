"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "qi-family-tree-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavorites(new Set(parsed));
        }
      }
    } catch (e) {
      console.error("Failed to load favorites from localStorage:", e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever favorites change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    } catch (e) {
      console.error("Failed to save favorites to localStorage:", e);
    }
  }, [favorites, isLoaded]);

  const toggleFavorite = useCallback((nodeId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (nodeId: string) => favorites.has(nodeId),
    [favorites]
  );

  const addFavorite = useCallback((nodeId: string) => {
    setFavorites((prev) => new Set([...prev, nodeId]));
  }, []);

  const removeFavorite = useCallback((nodeId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  return {
    favorites,
    isLoaded,
    toggleFavorite,
    isFavorite,
    addFavorite,
    removeFavorite,
  };
}
