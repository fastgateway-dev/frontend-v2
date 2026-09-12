// Helper extracted so the post-create signal can be unit-tested without
// mounting the very large create page. Called from the page's onSubmit
// after a successful routesApi.create, with the prefill key from the URL.
import { postRouteCreatedFromPrefill } from '@/lib/utils/importBroadcast';

export function signalCreatedFromPrefill(
  prefillKey: string | null,
  routeId: string,
  routeName: string,
): void {
  if (!prefillKey) return;
  postRouteCreatedFromPrefill(prefillKey, routeId, routeName);
  try {
    sessionStorage.removeItem(prefillKey);
  } catch {
    // sessionStorage can throw in some sandboxed contexts; ignore.
  }
}
