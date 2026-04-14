// Allow the workspace proxy to handle trailing slash behavior itself.
// Without this, SvelteKit normalizes /apps/uuid/v1/ → /apps/uuid/v1 which
// conflicts with the workspace server's own routing.
export const trailingSlash = 'ignore';
