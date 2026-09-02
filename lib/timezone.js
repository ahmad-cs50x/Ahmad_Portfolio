export function formatInTimeZone(date, timeZone, options = {}) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
      ...options,
    }).format(d);
  } catch {
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }
}

function tzOffsetLabel(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(date));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/**
 * Timestamps are stored UTC. If both sides share an IANA timezone,
 * show ONE timestamp. Otherwise show BOTH ("Your time" / "Their time").
 */
export function formatMessageTimestamp(dateUtc, viewerTz, otherPartyTz) {
  const sameTz =
    !otherPartyTz || !viewerTz || viewerTz === otherPartyTz;

  if (sameTz) {
    return {
      same: true,
      primary: formatInTimeZone(dateUtc, viewerTz),
      zone: tzOffsetLabel(dateUtc, viewerTz),
    };
  }

  return {
    same: false,
    viewer: {
      label: "Your time",
      value: formatInTimeZone(dateUtc, viewerTz),
      zone: tzOffsetLabel(dateUtc, viewerTz),
    },
    other: {
      label: "Their time",
      value: formatInTimeZone(dateUtc, otherPartyTz),
      zone: tzOffsetLabel(dateUtc, otherPartyTz),
    },
  };
}

export const COMMON_TIMEZONES = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

export function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
