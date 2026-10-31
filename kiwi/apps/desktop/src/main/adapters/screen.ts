import { desktopCapturer, screen } from 'electron';
import type { ScreenPort } from '@kiwi/core';

const MODEL_WIDTH = 1280;
const THUMBNAIL_WIDTH = 240;

export function createScreenPort(): ScreenPort {
  return {
    async capture() {
      const { size, scaleFactor } = screen.getPrimaryDisplay();
      const width = Math.min(MODEL_WIDTH, size.width * scaleFactor);
      const height = Math.round((width / size.width) * size.height);
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height },
      });
      const image = sources[0]?.thumbnail;
      if (!image || image.isEmpty())
        throw new Error('The screen could not be captured. Check screen recording permission.');
      return {
        imageBase64: image.toPNG().toString('base64'),
        thumbnailDataUrl: image.resize({ width: THUMBNAIL_WIDTH }).toDataURL(),
      };
    },
  };
}
