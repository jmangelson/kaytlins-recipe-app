/**
 * Recipe photo scan: the app posts photos with the signed-in user's Firebase
 * ID token; this Worker checks the token and the allowed list, counts the
 * scan against daily limits, asks Claude to read the recipe into the app's
 * fixed JSON format (structured output), and returns it for her to review.
 * The Anthropic API key lives only here, as a Worker secret.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import {
  parseScanResult,
  scanJsonSchema,
  type ScanRequest,
} from '../../src/features/scan/scan-contract';
import { readRecipe } from './read-recipe';
import { limitKeys, scanRequestProblem } from './scan-request';

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** Comma-separated Google account emails allowed to scan (a secret). */
  ALLOWED_EMAILS: string;
  FIREBASE_PROJECT_ID: string;
  DAILY_LIMIT_PER_USER: string;
  DAILY_LIMIT_TOTAL: string;
  SCAN_LIMITS: KVNamespace;
}

// Google's keys for Firebase Auth ID tokens (jose caches them).
const FIREBASE_KEYS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
);

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** An error the app shows as-is: `message` is written for her. */
function problem(status: number, error: string, message: string): Response {
  return reply(status, { error, message });
}

async function scan(request: Request, env: Env): Promise<Response> {
  // Who is asking: a valid Firebase sign-in for this project, on the list.
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return problem(401, 'signed_out', 'Sign in again, then try the scan.');
  let uid: string;
  let email: string;
  try {
    const { payload } = await jwtVerify(token, FIREBASE_KEYS, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
    });
    if (!payload.sub || payload.email_verified !== true) throw new Error('unverified');
    uid = payload.sub;
    email = String(payload.email ?? '').toLowerCase();
  } catch {
    return problem(401, 'signed_out', 'Sign in again, then try the scan.');
  }
  const allowed = env.ALLOWED_EMAILS.split(',').map((e) => e.trim().toLowerCase());
  if (!allowed.includes(email)) {
    return problem(403, 'not_allowed', 'This account isn’t set up for recipe scanning.');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, 'bad_request', 'The photos didn’t arrive. Try again.');
  }
  const invalid = scanRequestProblem(body);
  if (invalid) return problem(400, 'bad_request', invalid);
  const { images, tags } = body as ScanRequest;

  // Daily limits, per person and for the whole app (KV; resets at midnight UTC).
  const keys = limitKeys(uid, new Date());
  const [used, usedTotal] = await Promise.all([
    env.SCAN_LIMITS.get(keys.user).then(Number),
    env.SCAN_LIMITS.get(keys.total).then(Number),
  ]);
  const perUser = Number(env.DAILY_LIMIT_PER_USER);
  if (used >= perUser || usedTotal >= Number(env.DAILY_LIMIT_TOTAL)) {
    return problem(
      429,
      'daily_limit',
      `That’s the limit of ${perUser} scans for today. Try again tomorrow, or type the recipe in.`
    );
  }
  const twoDays = { expirationTtl: 2 * 24 * 60 * 60 };
  await Promise.all([
    env.SCAN_LIMITS.put(keys.user, String(used + 1), twoDays),
    env.SCAN_LIMITS.put(keys.total, String(usedTotal + 1), twoDays),
  ]);

  const outcome = await readRecipe(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), {
    images,
    tags,
  });
  if (!outcome.ok) return problem(outcome.status, outcome.error, outcome.message);
  return reply(200, outcome.result);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/scan' && request.method === 'POST') return scan(request, env);
    if (url.pathname === '/health') return reply(200, { ok: true });
    return problem(404, 'not_found', 'Not found.');
  },
} satisfies ExportedHandler<Env>;
