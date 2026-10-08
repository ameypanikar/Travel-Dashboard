// Offline Document Caching & Local Storage Layer
// Caches tickets, boarding passes, DigiYatra QR codes, and dashboard snapshots for in-flight / offline access

import { useState, useEffect } from "react";

const DOCS_CACHE_NAME = "travel-dashboard-docs-v1";
const SNAPSHOT_KEY = "travel_dashboard_offline_snapshot";

/**
 * Hook to track online/offline connection state in real time
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Caches a document (PDF, PNG, JPEG) in the browser's CacheStorage for instant offline retrieval
 */
export async function cacheDocument(url: string): Promise<boolean> {
  if (!url || typeof window === "undefined" || !("caches" in window)) return false;
  // Google Drive URLs do not support CORS fetches from third-party origins
  if (url.includes("drive.google.com") || url.includes("googleusercontent.com")) return false;

  try {
    const cache = await caches.open(DOCS_CACHE_NAME);
    const response = await fetch(url, { mode: "cors" });
    if (response.ok) {
      await cache.put(url, response);
      return true;
    }
  } catch (err) {
    console.warn("Failed to cache document offline:", url, err);
  }
  return false;
}

/**
 * Checks if a specific document URL is stored in CacheStorage
 */
export async function isDocumentCached(url: string): Promise<boolean> {
  if (!url || typeof window === "undefined" || !("caches" in window)) return false;

  try {
    const cache = await caches.open(DOCS_CACHE_NAME);
    const match = await cache.match(url);
    return Boolean(match);
  } catch {
    return false;
  }
}

/**
 * Returns a direct ObjectURL / cached response for a document, allowing offline viewing
 */
export async function getCachedDocumentBlobUrl(url: string): Promise<string | null> {
  if (!url || typeof window === "undefined" || !("caches" in window)) return null;

  try {
    const cache = await caches.open(DOCS_CACHE_NAME);
    const match = await cache.match(url);
    if (match) {
      const blob = await match.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn("Failed to read cached document:", err);
  }
  return null;
}

/**
 * Saves a snapshot of dashboard data in localStorage for offline fallback
 */
export function saveDashboardOfflineSnapshot(data: unknown) {
  if (typeof window === "undefined" || !data) return;
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Could not save offline dashboard snapshot:", e);
  }
}

/**
 * Retrieves the latest offline snapshot
 */
export function getDashboardOfflineSnapshot<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
