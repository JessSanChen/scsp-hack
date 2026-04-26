/**
 * Shape of /demo/manifest.json - written by frontend/scripts/prepare-demo.mjs.
 */

export interface DemoManifestRun {
  id: string;
  title?: string;
  events: string;
}

export interface DemoManifestFork {
  id: string;
  title: string;
  description: string;
  fromTurn: number;
  events: string;
}

export interface DemoManifest {
  baseline: DemoManifestRun;
  forks: DemoManifestFork[];
}

export async function loadManifest(url: string): Promise<DemoManifest> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`loadManifest: ${url} -> HTTP ${resp.status}`);
  }
  return (await resp.json()) as DemoManifest;
}
