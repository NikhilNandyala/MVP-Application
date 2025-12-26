/**
 * Generate URL-safe slug from title
 */

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove special characters except hyphens
    .replace(/[^\w\-]+/g, '')
    // Remove multiple consecutive hyphens
    .replace(/\-\-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length
    .substring(0, 100)
    || 'untitled';
}

/**
 * Generate filename from title
 */
export function generateFilename(title: string): string {
  const slug = generateSlug(title);
  return `${slug}.mdx`;
}
