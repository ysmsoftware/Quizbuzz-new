import * as faceapi from 'face-api.js';
import type { DetectionResult, FaceBoundingBox, ModelLoadStatus } from './types';

export class FaceDetectionEngine {
  private status: ModelLoadStatus = 'idle';
  private modelLoaded = false;
  private MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

  /**
   * Load the TinyFaceDetector model (~190KB) instead of SsdMobilenetv1
   * (~5.4MB). This detection loop runs every 2s for the entire quiz
   * duration (useFaceDetection.ts), and SsdMobilenetv1 + 68-point
   * landmarks is heavy enough on iOS Safari/Chrome's WebGL backend
   * (WebKit's TF.js perf trails desktop Chrome/Mac Safari by a lot) that
   * it was stalling the main thread right as a violation toast tried to
   * mount — the toast would render and its 5s auto-dismiss timer would
   * both "catch up" in the same burst once the stall cleared, looking
   * like it flashed and vanished in under a second. TinyFaceDetector is
   * face-api.js's own recommended model for real-time/mobile use and is
   * accurate enough for presence/count/gaze checks at this resolution.
   * face-api.js caches to IndexedDB automatically after first download.
   */
  async loadModel(): Promise<void> {
    if (this.modelLoaded) return;
    this.status = 'loading';

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.load(this.MODEL_URL),
        faceapi.nets.faceLandmark68Net.load(this.MODEL_URL),
      ]);
      this.modelLoaded = true;
      this.status = 'ready';
      console.log('[QuizPro] Face detection & landmark models loaded');
    } catch (err) {
      this.status = 'failed';
      console.error('[QuizPro] Failed to load face detection models:', err);
      throw new Error('Failed to load face detection models: ' + err);
    }
  }

  /**
   * Run face detection on a video element.
   * Returns DetectionResult with faceCount, brightness, boundingBoxes, and gazeAway.
   */
  async detect(video: HTMLVideoElement): Promise<DetectionResult> {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    // Video not ready yet
    if (video.readyState < 2) {
      return {
        faceCount: 0,
        brightness: 0,
        lightingOk: false,
        faces: [],
        timestamp: Date.now(),
        gazeAway: false,
      };
    }

    try {
      // inputSize 320 (vs the 416 default) trims a bit more per-frame cost —
      // presence/count/gaze doesn't need the extra resolution, and this is
      // the model swap issue 2's fix is built around (see loadModel above).
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
      
      let detections: any[] = [];
      try {
        detections = await faceapi.detectAllFaces(video, options).withFaceLandmarks();
      } catch (err) {
        // Fallback to simple face detection if landmarks cannot be parsed
        const simpleDets = await faceapi.detectAllFaces(video, options);
        detections = simpleDets.map(d => ({ detection: d }));
      }

      const brightness = this.measureBrightness(video);
      let gazeAway = false;

      const faces: FaceBoundingBox[] = detections.map((d) => {
        const det = d.detection || d;
        
        if (d.landmarks) {
          try {
            const nose = d.landmarks.getNose();
            const jaw = d.landmarks.getJawOutline();
            if (nose && nose.length >= 4 && jaw && jaw.length >= 17) {
              const noseTip = nose[3];
              const jawLeft = jaw[0];
              const jawRight = jaw[16];
              
              // Standard horizontal head yaw ratio:
              // ratio = left_distance / right_distance
              const distLeft = Math.abs(noseTip.x - jawLeft.x);
              const distRight = Math.abs(jawRight.x - noseTip.x);
              const ratio = distLeft / (distRight || 1);
              
              // If ratio is < 0.45 or > 2.2, the user is looking away horizontally (yaw rotation)
              if (ratio < 0.45 || ratio > 2.2) {
                gazeAway = true;
              }
            }
          } catch (e) {
            console.error('[QuizPro] Landmark gaze away estimation failed:', e);
          }
        }

        return {
          x: det.box.x,
          y: det.box.y,
          width: det.box.width,
          height: det.box.height,
          score: det.score,
        };
      });

      return {
        faceCount: detections.length,
        brightness,
        lightingOk: brightness > 40,
        faces,
        timestamp: Date.now(),
        gazeAway,
      };
    } catch (error) {
      console.error('[QuizPro] Face detection error:', error);
      return {
        faceCount: 0,
        brightness: 0,
        lightingOk: false,
        faces: [],
        timestamp: Date.now(),
        gazeAway: false,
      };
    }
  }

  /**
   * Sample pixels from a small canvas to compute average brightness.
   * Uses 64x48 sample for performance (not full resolution).
   */
  private measureBrightness(video: HTMLVideoElement): number {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 48;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;

      ctx.drawImage(video, 0, 0, 64, 48);
      const imageData = ctx.getImageData(0, 0, 64, 48);
      const pixels = imageData.data;

      let totalBrightness = 0;
      const sampleStep = 4; // sample every 4th pixel for speed
      let count = 0;

      for (let i = 0; i < pixels.length; i += 4 * sampleStep) {
        // Luminance: 0.299R + 0.587G + 0.114B
        totalBrightness +=
          0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        count++;
      }

      return count > 0 ? Math.round(totalBrightness / count) : 0;
    } catch (error) {
      console.error('[QuizPro] Brightness calculation error:', error);
      return 0;
    }
  }

  /**
   * Draw bounding boxes on a canvas overlay.
   * Green for single face, red for no/multiple faces.
   */
  drawBoundingBoxes(
    canvas: HTMLCanvasElement,
    result: DetectionResult,
    videoW: number,
    videoH: number
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / videoW;
    const scaleY = canvas.height / videoH;

    result.faces.forEach((face) => {
      ctx.strokeStyle = result.faceCount === 1 ? '#22C55E' : '#EF4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        face.x * scaleX,
        face.y * scaleY,
        face.width * scaleX,
        face.height * scaleY
      );
    });

    // No face — draw red border around entire frame
    if (result.faceCount === 0) {
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
      ctx.setLineDash([]);
    }
  }

  getStatus(): ModelLoadStatus {
    return this.status;
  }

  isReady(): boolean {
    return this.modelLoaded;
  }
}

// Singleton export — one engine instance for the whole app
export const faceEngine = new FaceDetectionEngine();
