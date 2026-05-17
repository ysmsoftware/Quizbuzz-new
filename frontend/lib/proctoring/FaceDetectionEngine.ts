import * as faceapi from 'face-api.js';
import type { DetectionResult, FaceBoundingBox, ModelLoadStatus } from './types';

export class FaceDetectionEngine {
  private status: ModelLoadStatus = 'idle';
  private modelLoaded = false;
  private MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

  /**
   * Load the tiny SSD MobileNetV1 model (~2MB).
   * face-api.js caches to IndexedDB automatically after first download.
   */
  async loadModel(): Promise<void> {
    if (this.modelLoaded) return;
    this.status = 'loading';

    try {
      await faceapi.nets.ssdMobilenetv1.load(this.MODEL_URL);
      this.modelLoaded = true;
      this.status = 'ready';
      console.log('[QuizPro] Face detection model loaded');
    } catch (err) {
      this.status = 'failed';
      console.error('[QuizPro] Failed to load face detection model:', err);
      throw new Error('Failed to load face detection model: ' + err);
    }
  }

  /**
   * Run face detection on a video element.
   * Returns DetectionResult with faceCount, brightness, boundingBoxes.
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
      };
    }

    try {
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      const detections = await faceapi.detectAllFaces(video, options);
      const brightness = this.measureBrightness(video);

      const faces: FaceBoundingBox[] = detections.map((d) => ({
        x: d.box.x,
        y: d.box.y,
        width: d.box.width,
        height: d.box.height,
        score: d.score,
      }));

      return {
        faceCount: detections.length,
        brightness,
        lightingOk: brightness > 40,
        faces,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[QuizPro] Face detection error:', error);
      return {
        faceCount: 0,
        brightness: 0,
        lightingOk: false,
        faces: [],
        timestamp: Date.now(),
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
