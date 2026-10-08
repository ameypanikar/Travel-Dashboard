export type UserEntry = { name: string; username: string; role: string };

export function stripPrefix(name: string): string {
  return name.replace(/^(mr\.?|mrs\.?|ms\.?|miss\.?|dr\.?|prof\.?)\s+/i, "").trim();
}

export function firstLastTokens(name: string): { first: string; last: string } | null {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return { first: words[0], last: words[words.length - 1] };
}

export function findCanonicalName(extracted: string, users: UserEntry[]): string | null {
  const clean = stripPrefix(extracted.trim()).toLowerCase().replace(/\s+/g, " ");
  if (!clean) return null;

  for (const u of users) {
    if (u.name.trim().toLowerCase() === clean) return u.username;
  }

  const extractedTokens = firstLastTokens(clean);
  if (!extractedTokens) return null;

  for (const u of users) {
    const canonicalTokens = firstLastTokens(u.name.trim().toLowerCase());
    if (!canonicalTokens) continue;
    if (
      canonicalTokens.first === extractedTokens.first &&
      canonicalTokens.last === extractedTokens.last
    ) {
      return u.username;
    }
  }

  const reversedTokens = { first: extractedTokens.last, last: extractedTokens.first };
  for (const u of users) {
    const canonicalTokens = firstLastTokens(u.name.trim().toLowerCase());
    if (!canonicalTokens) continue;
    if (
      canonicalTokens.first === reversedTokens.first &&
      canonicalTokens.last === reversedTokens.last
    ) {
      return u.username;
    }
  }

  for (const u of users) {
    if (u.username.trim().toLowerCase() === clean) return u.username;
  }

  return null;
}

export function normalizeAssignedTo(raw: string, users: UserEntry[]): string {
  if (!raw.trim()) return raw;

  const parts = raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  const normalized = parts.map((part) => {
    const matched = findCanonicalName(part, users);
    return matched ?? part;
  });
  return normalized.join(", ");
}

export function computeLayover(
  legA?: Record<string, string>,
  legB?: Record<string, string>
): { layoverAirport: string; layoverDuration: string } | null {
  if (!legA || !legB) return null;
  const arrDate = legA.arrival_date || legA.departure_date;
  const arrTime = legA.arrival_time;
  const depDate = legB.departure_date;
  const depTime = legB.departure_time;

  if (!arrDate || !arrTime || !depDate || !depTime) return null;

  const dpA = arrDate.split("/");
  const dpB = depDate.split("/");
  if (dpA.length !== 3 || dpB.length !== 3) return null;

  const [ddA, mmA, yyyyA] = dpA;
  const [hhA, mnA] = arrTime.split(":");
  const [ddB, mmB, yyyyB] = dpB;
  const [hhB, mnB] = depTime.split(":");

  const dateA = new Date(parseInt(yyyyA), parseInt(mmA) - 1, parseInt(ddA), parseInt(hhA || "0"), parseInt(mnA || "0"), 0);
  const dateB = new Date(parseInt(yyyyB), parseInt(mmB) - 1, parseInt(ddB), parseInt(hhB || "0"), parseInt(mnB || "0"), 0);

  const diffMs = dateB.getTime() - dateA.getTime();
  if (diffMs <= 0 || diffMs > 48 * 60 * 60 * 1000) return null; // > 48h is considered separate journey

  const totalMin = Math.round(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const airport = legA.to_code || legA.city_to || legB.from_code || "Layover";

  return {
    layoverAirport: airport,
    layoverDuration: `${h}h ${m > 0 ? `${m}m` : ""}`.trim(),
  };
}
