export type AudioTrack = {
  assetId?: string;      // Only for local files
  name: string;
  fileName?: string;     // Only for local files
  picture?: string;      // Album art (local or stream)
  artist?: string;
  album?: string;
  src: string;           // File path (local) or stream URL (stream)
  type: 'local' | 'stream';
};