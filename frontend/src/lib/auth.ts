import type { AccountInfo, PublicClientApplication } from '@azure/msal-browser';
import type { AppConfig } from './contracts';

let client: PublicClientApplication | null = null;
let msal: typeof import('@azure/msal-browser') | null = null;
let scope = '';
let tenantId = '';
let setup: Promise<void> | null = null;
let redirect: ReturnType<PublicClientApplication['handleRedirectPromise']> | null = null;

export async function configureAuth(auth: AppConfig['auth']): Promise<AccountInfo | null> {
  if (!auth) return null;
  scope = auth.scope;
  tenantId = auth.tenant_id;
  setup ??= (async () => {
    msal = await import('@azure/msal-browser');
    client = new msal.PublicClientApplication({
      auth: {
        clientId: auth.client_id,
        authority: `https://login.microsoftonline.com/${auth.tenant_id}`,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    await client.initialize();
  })();
  await setup;
  if (!client) throw new Error('Microsoft sign-in could not be initialized.');
  redirect ??= client.handleRedirectPromise();
  const result = await redirect;
  return result?.account?.tenantId === tenantId
    ? result.account
    : (client.getAllAccounts().find((account) => account.tenantId === tenantId) ?? null);
}

export async function signIn(): Promise<void> {
  await client?.loginRedirect({ scopes: [scope] });
}

export async function signOut(): Promise<void> {
  await client?.logoutRedirect();
}

export async function accessToken(): Promise<string | null> {
  if (!client) return null;
  const account = client.getAllAccounts().find((candidate) => candidate.tenantId === tenantId);
  if (!account) throw new Error('Sign in to use EcoCompute.');
  try {
    return (
      await client.acquireTokenSilent({
        scopes: [scope],
        account,
        redirectUri: `${window.location.origin}/blank.html`,
      })
    ).accessToken;
  } catch (error) {
    if (msal && error instanceof msal.InteractionRequiredAuthError) {
      await client.acquireTokenRedirect({ scopes: [scope], account });
    }
    throw error;
  }
}
