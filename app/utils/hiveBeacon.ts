/**
 * Hive Beacon (https://beacon.peakd.com) node health list. PeakD continuously probes the public Hive
 * MAINNET API nodes and scores them 0-100; we surface that list so a user can switch to a healthy node
 * when their current one is failing. Fetched from the renderer — the production CSP allows `connect-src
 * https:` and the app already makes cross-origin RPC calls to Hive nodes, so no main-process proxy is needed.
 */
export interface BeaconNode {
  name: string;
  endpoint: string; // full https:// URL to use as the RPC node
  score: number; // 0-100 health score
  version: string;
  lastBlock: number | null;
  success: number;
  fail: number;
}

const BEACON_URL = 'https://beacon.peakd.com/api/nodes';

/** Fetch the beacon node list, normalised + sorted best-score-first. Rejects on network/HTTP error. */
export async function fetchBeaconNodes(): Promise<BeaconNode[]> {
  const res = await fetch(BEACON_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Hive Beacon returned HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Unexpected Hive Beacon response shape');
  return data
    .map(
      (n: any): BeaconNode => ({
        name: n.name,
        endpoint: n.endpoint || (n.name?.startsWith('http') ? n.name : `https://${n.name}`),
        score: typeof n.score === 'number' ? n.score : 0,
        version: n.version || '-',
        lastBlock: n.lastBlock ?? null,
        success: n.success ?? 0,
        fail: n.fail ?? 0,
      })
    )
    .filter((n: BeaconNode) => !!n.endpoint)
    .sort((a: BeaconNode, b: BeaconNode) => b.score - a.score);
}
