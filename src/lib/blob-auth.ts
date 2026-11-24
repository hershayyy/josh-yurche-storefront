type Env = Record<string, string | undefined>;

// Hosted Vercel injects VERCEL_OIDC_TOKEN beside BLOB_STORE_ID. A local copy
// must see that token itself; the VERCEL flag alone is not a credential.
export function hasBlobCredentials(env: Env = process.env, hosted = Boolean(env.VERCEL)) {
  if (env.BLOB_READ_WRITE_TOKEN) return true;
  if (!env.BLOB_STORE_ID) return false;
  if (env.VERCEL_OIDC_TOKEN) return true;
  return hosted;
}
