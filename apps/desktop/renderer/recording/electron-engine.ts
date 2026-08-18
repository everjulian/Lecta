import { ElectronRecordingAdapter, type RecordingEngine } from '@lecta/recording';
import { FakeRecordingEngine } from './fake-recording-engine';

export interface MicrophoneOption {
  deviceId: string;
  label: string;
}

export function createRecordingEngine(): RecordingEngine {
  if (window.lecta.runtime.e2e) return new FakeRecordingEngine();
  return new ElectronRecordingAdapter({
    getSystemStream: async () => {
      const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      if (stream.getAudioTracks().length === 0)
        throw new Error('Windows no entregó audio del sistema');
      return stream;
    },
    getMicrophoneStream: (deviceId) =>
      navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
        video: false,
      }),
    createAudioContext: () => new AudioContext({ latencyHint: 'playback', sampleRate: 48_000 }),
    createMediaRecorder: (stream, options) => new MediaRecorder(stream, options),
    chunkSink: window.lecta.recording,
    now: () => Date.now(),
    chunkIntervalMs: 5_000,
  });
}

export async function listMicrophones(): Promise<readonly MicrophoneOption[]> {
  if (window.lecta.runtime.e2e)
    return [{ deviceId: 'e2e-microphone', label: 'Micrófono de prueba' }];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Micrófono ${index + 1}`,
    }));
}
