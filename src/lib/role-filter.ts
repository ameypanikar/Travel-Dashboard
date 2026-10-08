import { getSessionUser } from "./auth";

export const FULL_ACCESS_ROLES = ["system manager", "owner", "hr", "accounts"];

let globalKnownUsers: { name?: string; username?: string; role?: string }[] = [];

export function setGlobalKnownUsers(users: { name?: string; username?: string; role?: string }[]) {
  if (users && users.length > 0) {
    globalKnownUsers = users;
  }
}

function formatShort(name: string): string {
  const parts = name.replace(/[^\w\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name.trim();
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}`;
}

export function getPreferredCanonicalName(u: { name?: string; username?: string }): string {
  const n = (u.name || "").trim();
  const un = (u.username || "").trim();
  // If one of them has a single-letter last initial like "Rajesh K" or "Shubham P", prefer that
  if (/^[A-Za-z]+ [A-Z]$/.test(n)) return n;
  if (/^[A-Za-z]+ [A-Z]$/.test(un)) return un;
  // If one is mixed case and other is ALL CAPS, prefer mixed case
  const isAllUpper = (s: string) => s.length > 0 && s === s.toUpperCase() && s !== s.toLowerCase();
  if (!isAllUpper(n) && isAllUpper(un) && n) return formatShort(n);
  if (!isAllUpper(un) && isAllUpper(n) && un) return formatShort(un);
  return formatShort(n || un);
}

export function splitPassengerList(raw: string | string[] | undefined | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Split on commas, semicolons, ampersands, plus signs, newlines, or " and "
  // Do NOT split on slashes '/' because airlines use '/' between surname and given name (e.g. HEMAN/VISHWAS)
  return String(raw)
    .split(/[,;&+\n]|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Normalizes and canonicalizes any raw name or username into a consistent,
 * clean human-readable name (e.g. "SOMNING GIRGAON" -> "Somning G",
 * "VISHWAS HEMAN" -> "Vishwas H", "KULKARNI RAJESH VINAYAK MR" -> "Rajesh K",
 * "HEMAN/VISHWAS SURESH MR" -> "Vishwas H").
 */
export function canonicalizePersonName(
  raw: string,
  knownUsers?: { name?: string; username?: string }[]
): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "me" || trimmed.toLowerCase() === "all") {
    return trimmed;
  }

  // Airline tickets often format as "HEMAN/VISHWAS MR" or "KULKARNI/RAJESH VINAYAK MR"
  // Convert slash to space before parsing words and strip titles/suffixes
  const clean = trimmed
    .replace(/[\/\\]+/g, " ")
    .replace(/\b(mr|mrs|ms|miss|dr|master|prof)\b/gi, " ")
    .replace(/([a-zA-Z]{3,})(mr|mrs|ms|dr)\b/gi, "$1")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return trimmed;

  const usersList = knownUsers && knownUsers.length > 0 ? knownUsers : globalKnownUsers;

  // 1. Try matching against registered system users
  if (usersList && usersList.length > 0) {
    const rawLower = clean.toLowerCase();
    const words = rawLower.split(/\s+/).filter(Boolean);

    // 1a. Direct exact match with username, name, or canonical
    for (const u of usersList) {
      const uName = (u.name || "").trim().toLowerCase();
      const uUser = (u.username || "").trim().toLowerCase();
      const canonical = getPreferredCanonicalName(u).toLowerCase();

      if (rawLower === uUser || rawLower === uName || rawLower === canonical) {
        return getPreferredCanonicalName(u);
      }
    }

    // Index all users with first name, surname, and initials
    const indexed = usersList.map((u) => {
      const canonical = getPreferredCanonicalName(u);
      const partsCanon = canonical.split(/\s+/);
      const first = partsCanon[0].toLowerCase();
      const uName = (u.name || "").toLowerCase();
      const uUser = (u.username || "").toLowerCase();
      const allTokens = Array.from(new Set([...uName.split(/\s+/), ...uUser.split(/\s+/)]));
      const surnameToken = allTokens.find((t) => t.length > 1 && t.toLowerCase() !== first) || "";
      const lastInitial = (partsCanon[1] || surnameToken[0] || "").toLowerCase();
      return {
        u,
        canonical,
        first,
        surname: surnameToken.toLowerCase(),
        lastInitial,
      };
    });

    const firstCounts: Record<string, number> = {};
    indexed.forEach((item) => {
      firstCounts[item.first] = (firstCounts[item.first] || 0) + 1;
    });

    // 1b. Both first name AND surname present in words (handles any middle name in between or surname-first)
    // e.g. "Vishwas Suresh Heman", "Heman Vishwas Suresh", "Kulkarni Rajesh Vinayak", "HEMAN/VISHWAS SURESH MR"
    for (const item of indexed) {
      if (item.first && item.surname) {
        if (words.includes(item.first) && words.includes(item.surname)) {
          return item.canonical;
        }
      }
    }

    // 1c. First name AND word starting with last initial
    // e.g. "Vishwas H", "Vishwas S Heman", "Vishwas Suresh H"
    for (const item of indexed) {
      if (item.first && words.includes(item.first)) {
        const otherWords = words.filter((w) => w !== item.first);
        if (item.lastInitial && otherWords.some((w) => w.startsWith(item.lastInitial))) {
          return item.canonical;
        }
      }
    }

    // 1d. Unique first name in company (e.g. "Vishwas Suresh" where Suresh is middle/father name, or "Vishwas")
    for (const item of indexed) {
      if (item.first && firstCounts[item.first] === 1 && words.includes(item.first)) {
        const conflicts = indexed.some(
          (other) => other !== item && other.surname && words.includes(other.surname)
        );
        if (!conflicts) {
          return item.canonical;
        }
      }
    }

    // 1e. Unique surname in company (e.g. "Dahibhate" or "Girgaon" on a ticket)
    for (const item of indexed) {
      if (item.surname && words.length === 1 && words[0] === item.surname) {
        return item.canonical;
      }
    }
  }

  // 2. Format if no user matched
  return formatShort(clean);
}

/**
 * Validates that an assignee string represents an actual human traveler,
 * filtering out hotel names, vendor/company names (e.g. Keetronics Ltd),
 * or corrupted/non-person strings accidentally entered in assignedto.
 */
export function isRealPersonName(
  name: string,
  knownUsers?: { name?: string; username?: string }[]
): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "me" || lower === "all") return true;

  // Filter out known companies/vendors/hotels entered in assignedto
  if (
    /\b(limited|ltd|pvt|private|corp|corporation|inc|incorporated|company|industries|hotel|inn|travels|holidays)\b/i.test(lower) ||
    lower.includes("keetronics")
  ) {
    return false;
  }

  // Filter known non-person garbage tokens
  if (lower.startsWith("madhidhagir") || lower === "urban inn" || lower === "ashirwad") {
    return false;
  }

  const usersList = knownUsers && knownUsers.length > 0 ? knownUsers : globalKnownUsers;

  // If known registered users exist, check if name matches any user or looks like a valid first/last name
  if (usersList && usersList.length > 0) {
    const matched = usersList.some((u) => {
      const uName = (u.name || "").trim().toLowerCase();
      const uUser = (u.username || "").trim().toLowerCase();
      if (!uName && !uUser) return false;
      return (
        lower === uName ||
        lower === uUser ||
        lower.startsWith(uUser) ||
        lower.startsWith(uName) ||
        uName.includes(lower) ||
        uUser.includes(lower) ||
        lower.includes(uName) ||
        lower.includes(uUser)
      );
    });
    if (!matched) {
      // If it doesn't match any known user and doesn't look like a human name (no space and long random letters)
      if (!lower.includes(" ") && lower.length > 10) return false;
    }
  } else {
    if (!lower.includes(" ") && lower.length > 10) return false;
  }

  return true;
}

/**
 * Deduplicates a list of assignee strings by canonical person name,
 * ensuring "SOMNING GIRGAON" and "Somning G" produce exactly 1 item: "Somning G",
 * while filtering out companies and non-person entries.
 */
export function deduplicateAssignees(
  names: string[],
  knownUsers?: { name?: string; username?: string }[]
): string[] {
  const usersList = knownUsers && knownUsers.length > 0 ? knownUsers : globalKnownUsers;
  const map = new Map<string, string>();
  for (const raw of names) {
    const passengers = splitPassengerList(raw);
    for (const passenger of passengers) {
      if (!isRealPersonName(passenger, usersList)) continue;
      const canonical = canonicalizePersonName(passenger, usersList);
      if (!isRealPersonName(canonical, usersList)) continue;
      const key = canonical.toLowerCase();
      if (!map.has(key)) {
        map.set(key, canonical);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Checks if a booking's assignedto or an expense belongs to the target filtered person,
 * matching across name variations (e.g. "SOMNING GIRGAON" matches "Somning G",
 * "HEMAN/VISHWAS SURESH MR" matches "Vishwas H").
 */
export function isPersonMatch(
  rawField: string | undefined,
  targetFilter: string | undefined,
  knownUsers?: { name?: string; username?: string }[]
): boolean {
  if (!rawField || !targetFilter) return false;
  if (targetFilter.toLowerCase() === "all") return true;

  const usersList = knownUsers && knownUsers.length > 0 ? knownUsers : globalKnownUsers;

  if (targetFilter.toLowerCase() === "me") {
    const user = getSessionUser();
    if (!user) return false;
    return (
      (Boolean(user.name) && isPersonMatch(rawField, user.name, usersList)) ||
      (Boolean(user.username) && isPersonMatch(rawField, user.username, usersList))
    );
  }

  const targetLower = targetFilter.trim().toLowerCase();
  const targetCanonical = canonicalizePersonName(targetFilter, usersList).toLowerCase();

  // Split multiple passengers using airline-aware delimiter
  const parts = splitPassengerList(rawField);
  return parts.some((p) => {
    const pTrim = p.trim().toLowerCase();
    const pClean = pTrim.replace(/[\/\\]+/g, " ");
    const pCanonical = canonicalizePersonName(p, usersList).toLowerCase();

    // 1. Canonical equality (e.g. "Vishwas H" === "Vishwas H")
    if (pCanonical && targetCanonical && pCanonical === targetCanonical) return true;

    // 2. Direct string equality or inclusions
    if (pTrim === targetLower || pClean === targetLower) return true;
    if (pTrim.includes(targetLower) || targetLower.includes(pTrim)) return true;
    if (pClean.includes(targetLower) || targetLower.includes(pClean)) return true;

    // 3. Fallback: match tokens if multiple words
    const targetWords = targetLower.split(/\s+/).filter(Boolean);
    const pWords = pClean.split(/\s+/).filter(Boolean);
    if (targetWords.length >= 2 && targetWords.every((w) => pWords.includes(w))) return true;

    return false;
  });
}

export function isAssignedToMe(
  assignedto: string | undefined,
  name: string,
  knownUsers?: { name?: string; username?: string }[]
): boolean {
  if (!assignedto || !name) return false;
  return isPersonMatch(assignedto, name, knownUsers);
}

export function filterByRole<T extends Record<string, unknown>>(
  items: T[],
  knownUsers?: { name?: string; username?: string }[]
): T[] {
  if (!items) return [];
  const user = getSessionUser();
  if (!user) return items;
  const role = (user.role || "").trim().toLowerCase();
  if (FULL_ACCESS_ROLES.includes(role)) return items;
  const usersList = knownUsers && knownUsers.length > 0 ? knownUsers : globalKnownUsers;

  // Check both name and username across canonical matches and literal contains
  return items.filter((it) => {
    const assignedto = (it as unknown as Record<string, string>).assignedto;
    return (
      (Boolean(user.name) && isPersonMatch(assignedto, user.name, usersList)) ||
      (Boolean(user.username) && isPersonMatch(assignedto, user.username, usersList))
    );
  });
}