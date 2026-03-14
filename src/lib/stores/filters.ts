/**
 * Persistent filter store using localStorage.
 * Each page namespace stores its own filter values so they survive
 * navigation and browser refreshes.
 */

const PREFIX = 'ir_filter_';

type FilterMap = Record<string, string>;

function isBrowser(): boolean {
	return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Load saved filters for a given namespace (e.g. 'innovations', 'catalog').
 * Returns an empty object when running on the server or when nothing is stored.
 */
export function loadFilters(namespace: string): FilterMap {
	if (!isBrowser()) return {};
	try {
		const raw = localStorage.getItem(PREFIX + namespace);
		return raw ? (JSON.parse(raw) as FilterMap) : {};
	} catch {
		return {};
	}
}

/**
 * Persist a filter value for the given namespace.
 * Passing null/undefined/empty string removes the key.
 */
export function saveFilter(namespace: string, key: string, value: string | null | undefined): void {
	if (!isBrowser()) return;
	try {
		const existing = loadFilters(namespace);
		if (value) {
			existing[key] = value;
		} else {
			delete existing[key];
		}
		localStorage.setItem(PREFIX + namespace, JSON.stringify(existing));
	} catch {
		// localStorage can be unavailable in private browsing; silently ignore.
	}
}

/**
 * Persist multiple filter values at once for the given namespace.
 */
export function saveFilters(namespace: string, filters: FilterMap): void {
	if (!isBrowser()) return;
	try {
		const existing = loadFilters(namespace);
		for (const [key, value] of Object.entries(filters)) {
			if (value) {
				existing[key] = value;
			} else {
				delete existing[key];
			}
		}
		localStorage.setItem(PREFIX + namespace, JSON.stringify(existing));
	} catch {
		// Silently ignore.
	}
}

/**
 * Clear all saved filters for a namespace.
 */
export function clearFilters(namespace: string): void {
	if (!isBrowser()) return;
	try {
		localStorage.removeItem(PREFIX + namespace);
	} catch {
		// Silently ignore.
	}
}
