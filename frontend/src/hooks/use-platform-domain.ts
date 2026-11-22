"use client";

import * as React from "react";
import { apiClient } from "@/lib/api-client";

export const FIXED_PLATFORM_DOMAIN = "doczeno.vercel.app";

let globalDomainCache: string = FIXED_PLATFORM_DOMAIN;
let globalFetchPromise: Promise<string> | null = null;
const listeners = new Set<(domain: string) => void>();

function setGlobalDomain(_newDomain: string) {
  // Fixed immutable platform domain: cannot be changed
  globalDomainCache = FIXED_PLATFORM_DOMAIN;
  listeners.forEach((listener) => listener(FIXED_PLATFORM_DOMAIN));
}

export function usePlatformDomain() {
  const [domain, setDomain] = React.useState<string>(globalDomainCache);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Subscribe to domain changes across tabs/components
    const listener = (updated: string) => setDomain(updated);
    listeners.add(listener);

    // Fetch from backend if not already resolved or on mount
    if (!globalFetchPromise) {
      setIsLoading(true);
      globalFetchPromise = apiClient
        .get<{ success?: boolean; data?: { platformDomain?: string } }>(
          "/onboarding/platform-config"
        )
        .then((res) => {
          const fetchedDomain = res?.data?.platformDomain;
          if (fetchedDomain) {
            setGlobalDomain(fetchedDomain);
            return fetchedDomain;
          }
          return globalDomainCache;
        })
        .catch(() => {
          return globalDomainCache;
        })
        .finally(() => {
          setIsLoading(false);
        });
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  /**
   * Helper to format a relative path into a public URL
   * e.g. formatUrl("dr-sharma") => "doczeno.vercel.app/dr-sharma"
   * e.g. formatUrl("apollo/dr-sharma", true) => "https://doczeno.vercel.app/apollo/dr-sharma"
   */
  const formatUrl = React.useCallback(
    (pathOrSlug: string, isFullProtocol = false) => {
      const cleanPath = pathOrSlug.replace(/^\/+/, "");
      const base = `${domain}/${cleanPath}`;
      return isFullProtocol ? `https://${base}` : base;
    },
    [domain]
  );

  /**
   * Helper to format prefix for SlugInput
   * e.g. formatPrefix() => "doczeno.vercel.app/"
   * e.g. formatPrefix("apollo") => "doczeno.vercel.app/apollo/"
   */
  const formatPrefix = React.useCallback(
    (hospitalSlug?: string) => {
      if (hospitalSlug) {
        return `${domain}/${hospitalSlug.replace(/^\/+|\/+$/g, "")}/`;
      }
      return `${domain}/`;
    },
    [domain]
  );

  return {
    platformDomain: domain,
    formatUrl,
    formatPrefix,
    setPlatformDomain: setGlobalDomain,
    isLoading,
  };
}

/**
 * Non-hook synchronous fallback for server-rendered or static helper contexts
 */
export function getPlatformDomainSync(): string {
  return globalDomainCache;
}
