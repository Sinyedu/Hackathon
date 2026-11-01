/// <reference types="vite/client" />
import type { KiwiApi } from '@kiwi/shared';

declare global {
  interface Window {
    kiwi: KiwiApi;
  }
}
