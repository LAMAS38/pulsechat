export const SLUG_REGEX = /^[a-z0-9-]{3,32}$/;

const RESERVED_SLUGS = new Set(["ws", "api", "admin", "health"]);

export interface SlugValidationResult {
  valid: boolean;
  slug?: string;
  error?: string;
}

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateSlug(raw: string): SlugValidationResult {
  const slug = normalizeSlug(raw);

  if (!SLUG_REGEX.test(slug)) {
    return {
      valid: false,
      error: "invalid_slug",
    };
  }

  if (RESERVED_SLUGS.has(slug)) {
    return {
      valid: false,
      error: "reserved_slug",
    };
  }

  return { valid: true, slug };
}

export const USERNAME_REGEX = /^[\p{L}\p{N} _-]{2,24}$/u;

export function validateUsername(raw: string): { valid: boolean; username?: string; error?: string } {
  const username = raw.trim();

  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, error: "invalid_username" };
  }

  return { valid: true, username };
}
