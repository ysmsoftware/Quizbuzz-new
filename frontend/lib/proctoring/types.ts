// ============================================
// Face Detection Types
// ============================================

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number; // detection confidence 0-1
}

export interface DetectionResult {
  faceCount: number;
  brightness: number; // 0-255 average pixel brightness
  lightingOk: boolean; // brightness > 40
  faces: FaceBoundingBox[];
  timestamp: number;
}

export type ModelLoadStatus = 'idle' | 'loading' | 'ready' | 'failed';
