// libsecret wrapper. The API key lives in the user's keyring, never on disk
// and never in GSettings/dconf.

import Secret from 'gi://Secret';
import { SECRET_SCHEMA, SECRET_ATTRIBUTES } from './constants.js';

const FLAGS = Secret.SchemaFlags.NONE;

function getSchema() {
    return Secret.Schema.new(
        SECRET_SCHEMA,
        FLAGS,
        { application: Secret.SchemaAttributeType.STRING },
    );
}

function asyncCall(fn, args, finishFn) {
    return new Promise((resolve, reject) => {
        const callback = (source, result) => {
            try {
                resolve(finishFn(result));
            } catch (e) {
                reject(e);
            }
        };
        fn(...args, null, callback);
    });
}

export async function getApiKey() {
    return await asyncCall(
        Secret.password_lookup,
        [getSchema(), SECRET_ATTRIBUTES],
        (result) => Secret.password_lookup_finish(result),
    );
}

export async function setApiKey(key) {
    if (typeof key !== 'string' || key.length === 0) {
        throw new Error('api key must be a non-empty string');
    }
    await asyncCall(
        Secret.password_store,
        [getSchema(), SECRET_ATTRIBUTES, Secret.COLLECTION_DEFAULT, 'MiniMax API Key', key],
        (result) => Secret.password_store_finish(result),
    );
}

export async function clearApiKey() {
    await asyncCall(
        Secret.password_clear,
        [getSchema(), SECRET_ATTRIBUTES],
        (result) => Secret.password_clear_finish(result),
    );
}
