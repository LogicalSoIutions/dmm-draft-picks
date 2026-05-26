const ISO_TIMEZONE_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parse a timestamp string into a Date. Strings without a timezone marker
 * (e.g. SQLite's `CURRENT_TIMESTAMP` output `"YYYY-MM-DD HH:MM:SS"`) are
 * treated as UTC rather than letting `new Date()` ambiguously interpret them
 * as local time across browsers.
 */
const parseTimestamp = (value: string): Date => {
  const trimmed = value.trim();
  if (!trimmed) {
    return new Date(NaN);
  }
  if (ISO_TIMEZONE_SUFFIX.test(trimmed)) {
    return new Date(trimmed);
  }
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return new Date(`${normalized}Z`);
};

/**
 * Format a UTC timestamp string for display in US Eastern time, with an
 * explicit `"EST"` suffix.
 */
export const formatEasternDateTime = (value: string): string => {
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toLocaleString("en-US", { timeZone: "America/New_York" })} EST`;
};
