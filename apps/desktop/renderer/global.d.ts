import type { LectaApi } from '../shared/session-contracts';
declare global {
  interface Window {
    lecta: LectaApi;
  }
}
export {};
