import { validateHttpUrl } from './validate-http-url';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const MAX_REDIRECTS = 5;

export async function safeFetch(
  initialUrl: URL,
  init: RequestInit,
): Promise<Response> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await fetch(currentUrl, {
      ...init,
      redirect: 'manual',
    });

    if (!REDIRECT_STATUSES.has(response.status)) {
      return response;
    }

    if (redirectCount === MAX_REDIRECTS) {
      throw new Error('Too many HTTP redirects');
    }

    if (init.method !== 'GET') {
      throw new Error('Redirects are only allowed for GET requests');
    }

    const location = response.headers.get('location');

    if (!location) {
      throw new Error('Redirect response is missing Location header');
    }

    const redirectUrl = new URL(location, currentUrl);

    const validatedRedirectUrl = await validateHttpUrl(redirectUrl.toString());

    if (validatedRedirectUrl.origin !== currentUrl.origin) {
      throw new Error('Cross-origin redirects are not allowed');
    }

    currentUrl = validatedRedirectUrl;
  }

  throw new Error('Unexpected redirect handling error');
}
