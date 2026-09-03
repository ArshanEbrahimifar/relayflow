import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);

  const [first, second] = parts;

  if (first === 0) {
    return true;
  }

  if (first === 10) {
    return true;
  }

  if (first === 127) {
    return true;
  }

  if (first === 169 && second === 254) {
    return true;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  if (first === 192 && second === 168) {
    return true;
  }

  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

export async function validateHttpUrl(value: string): Promise<URL> {
  const url = new URL(value);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }

  const hostname = url.hostname.toLowerCase();

  const normalizedHostname =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;

  if (
    normalizedHostname === 'localhost' ||
    normalizedHostname.endsWith('.localhost')
  ) {
    throw new Error('Localhost URLs are not allowed');
  }

  const ipVersion = isIP(normalizedHostname);

  if (ipVersion === 4 && isPrivateIpv4(normalizedHostname)) {
    throw new Error('Private IP addresses are not allowed');
  }

  if (ipVersion === 6) {
    throw new Error('Direct IPv6 addresses are not allowed');
  }

  if (ipVersion === 0) {
    const addresses = await lookup(normalizedHostname, {
      all: true,
      verbatim: true,
    });

    for (const result of addresses) {
      if (result.family === 4 && isPrivateIpv4(result.address)) {
        throw new Error('Hostname resolves to a private IP address');
      }
      if (result.family === 6 && isPrivateIpv6(result.address)) {
        throw new Error('Hostname resolves to a private IPv6 address');
      }
    }
  }

  return url;
}
