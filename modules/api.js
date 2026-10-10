// Network entry. Returns normalized quota or throws a typed error.
// Delegates parsing to modules/parser.js (tested separately).
//
// Why Soup rather than fetch(): GJS's built-in fetch() goes through
// SpiderMonkey's networking stack, which has been historically flaky
// inside GNOME Shell extensions (silent failures, no way to set timeouts,
// no proxy awareness). Soup.Session is the canonical, well-tested path
// for extensions and works on every GNOME 40+ build.

import Soup from 'gi://Soup';
import { ENDPOINT_URL, HTTP_TIMEOUT_SECONDS } from './constants.js';
import { parseQuotaResponse, QuotaParseError } from './parser.js';

export class QuotaAuthError extends Error {
    constructor() { super('Unauthorized'); this.name = 'QuotaAuthError'; }
}
export class QuotaRateLimitError extends Error {
    constructor(retryAfterSec) {
        super('Rate limited');
        this.name = 'QuotaRateLimitError';
        this.retryAfterSec = retryAfterSec;
    }
}
export class QuotaServerError extends Error {
    constructor(status) { super(`HTTP ${status}`); this.name = 'QuotaServerError'; this.status = status; }
}
export class QuotaNetworkError extends Error {
    constructor(cause) {
        super(cause?.message ?? 'network error');
        this.name = 'QuotaNetworkError';
        this.cause = cause;
    }
}
export { QuotaParseError };

// Soup 3 (GNOME 41+) is async/cancellable. Soup 2 (GNOME 40) uses
// _send/_send_finish. We detect the API at module-load and dispatch.
function detectApi() {
    const sessionProto = Soup.Session.prototype;
    if (typeof sessionProto.send_and_read_async === 'function') return 'soup3';
    if (typeof sessionProto.send_async === 'function') return 'soup2';
    throw new Error('No usable Soup.Session API (neither send_and_read_async nor send_async found)');
}

const SOUP_API = detectApi();

function newSession() {
    const session = new Soup.Session();
    session.timeout = HTTP_TIMEOUT_SECONDS;
    return session;
}

function sendSoup3(session, msg) {
    return new Promise((resolve, reject) => {
        session.send_and_read_async(msg, Soup.MessagePriority.NORMAL, null, (src, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                resolve(bytes);
            } catch (e) {
                reject(e);
            }
        });
    });
}

function sendSoup2(session, msg) {
    return new Promise((resolve, reject) => {
        session.send_async(msg, Soup.MessagePriority.NORMAL, null, (src, res) => {
            try {
                resolve(session.send_finish(res));
            } catch (e) {
                reject(e);
            }
        });
    });
}

const sendAsync = SOUP_API === 'soup3' ? sendSoup3 : sendSoup2;

export async function fetchQuota(apiKey) {
    const session = newSession();
    const msg = Soup.Message.new('GET', ENDPOINT_URL);
    msg.request_headers.append('Authorization', `Bearer ${apiKey}`);
    msg.request_headers.append('Accept', 'application/json');

    let bytes;
    try {
        bytes = await sendAsync(session, msg);
    } catch (e) {
        logError(e, `[MiniMax] Soup ${SOUP_API} send failed`);
        throw new QuotaNetworkError(e);
    }

    const status = msg.status_code;
    if (status === 401) throw new QuotaAuthError();
    if (status === 429) {
        const raHeader = msg.response_headers.get_one('Retry-After');
        const ra = parseInt(raHeader ?? '60', 10);
        throw new QuotaRateLimitError(Number.isFinite(ra) ? ra : 60);
    }
    if (status >= 500) throw new QuotaServerError(status);
    if (!status || status >= 400) throw new QuotaServerError(status);

    let body;
    try {
        const decoder = new TextDecoder('utf-8');
        body = JSON.parse(decoder.decode(bytes.get_data()));
    } catch (e) {
        // Surface the raw response in journalctl so we can see what the
        // server actually returned (HTML login page, empty body, etc.).
        const decoder = new TextDecoder('utf-8');
        const raw = decoder.decode(bytes.get_data());
        logError(new Error(`Body was not JSON (first 500 chars): ${raw.slice(0, 500)}`),
            '[MiniMax] parse failure');
        throw new QuotaParseError(`response is not JSON: ${e.message}`);
    }

    // The MiniMax API uses a 200 + base_resp envelope for soft errors
    // (notably auth failures, where it returns 1004 "cookie is missing"
    // instead of 401). Check the envelope before assuming the body is a
    // quota payload.
    if (body && body.base_resp && typeof body.base_resp.status_code === 'number'
        && body.base_resp.status_code !== 0) {
        const code = body.base_resp.status_code;
        const msg = body.base_resp.status_msg || `base_resp error ${code}`;
        logError(new Error(`base_resp status_code=${code}, status_msg=${msg}`),
            '[MiniMax] API soft error');
        // 1004 is the documented auth/cookie error; treat unknown non-zero
        // codes the same way so the user gets a clear "wrong key" message
        // rather than a generic parse error.
        throw new QuotaAuthError(msg);
    }

    try {
        return parseQuotaResponse(body);
    } catch (e) {
        // Same trick: dump the body so we know which model_remains entry
        // is malformed.
        logError(new Error(`parseQuotaResponse threw: ${e.message}; body keys: ${Object.keys(body).join(',')}; first model_remains entry: ${JSON.stringify(body.model_remains?.[0]).slice(0, 500)}`),
            '[MiniMax] parse failure');
        throw e;
    }
}