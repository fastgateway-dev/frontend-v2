export type VersionStatus = 'supported' | 'untested' | 'unknown';

export interface ProbeResult {
  version: string;
  image?: string;
  source?: string;
  detected: boolean;
  error: string | null;
}

export interface SupportedPair {
  envoyGateway: string;
  gatewayAPI: string;
}

export interface ProjectVersionInfo {
  status: VersionStatus;
  envoyGateway: ProbeResult;
  gatewayAPI: ProbeResult;
  supportedPairs: SupportedPair[];
  checkedAt: string;
  cacheExpiresAt: string;
}
