import { randomBytes } from 'node:crypto';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Slug with a short random suffix, for entities whose titles need not be unique. */
export function uniqueSlug(input: string): string {
  return `${slugify(input) || 'item'}-${randomBytes(3).toString('hex')}`;
}
