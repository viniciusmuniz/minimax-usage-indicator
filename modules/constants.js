// Single source of truth for external identifiers and defaults.
// Imported by every other module.

export const ENDPOINT_URL = 'https://www.minimax.io/v1/api/openplatform/coding_plan/remains';

export const SECRET_SCHEMA = 'org.gnome.shell.extensions.MinimaxUsage';
export const SECRET_ATTRIBUTES = { application: 'minimax-usage-indicator' };

export const DEFAULT_REFRESH_SECONDS = 300;
export const MIN_REFRESH_SECONDS = 60;
export const MAX_REFRESH_SECONDS = 3600;

export const HTTP_TIMEOUT_SECONDS = 15;
