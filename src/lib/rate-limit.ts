const windowMs = 60 * 1000; // 1 minute
const maxRequests = 30;

const requests: number[] = [];

export function checkRateLimit(): boolean {
  const now = Date.now();
  // Remove expired entries
  while (requests.length > 0 && requests[0] < now - windowMs) {
    requests.shift();
  }
  if (requests.length >= maxRequests) return false;
  requests.push(now);
  return true;
}
