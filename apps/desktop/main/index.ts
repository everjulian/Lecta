import {
  app,
  BrowserWindow,
  desktopCapturer,
  net,
  protocol,
  session as electronSession,
} from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { registerSessionHandlers } from './ipc.js';
import { createContainer } from './container.js';
import { registerRecordingHandlers } from './recording-ipc.js';
import { registerTranscriptionHandlers } from './transcription-ipc.js';
import { registerAIHandlers } from './ai-ipc.js';
import { registerKnowledgeHandlers } from './knowledge-ipc.js';

protocol.registerSchemesAsPrivileged([
  { scheme: 'lecta-media', privileges: { secure: true, standard: true, stream: true } },
]);

const directory = path.dirname(fileURLToPath(import.meta.url));
function createWindow(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    webPreferences: {
      preload: path.join(directory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isTrustedRendererUrl(targetUrl)) event.preventDefault();
  });
  const devUrl = process.env['VITE_DEV_SERVER_URL'];
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(path.join(directory, '../../renderer/index.html'));
}

void app.whenReady().then(async () => {
  const environmentFile = path.join(app.getAppPath(), '.env');
  if (existsSync(environmentFile)) loadEnvFile(environmentFile);
  const container = createContainer(app.getPath('userData'), app.getAppPath());
  await container.transcriptionQueue.initialize();
  registerSessionHandlers(container);
  registerRecordingHandlers(container);
  const unsubscribeTranscription = registerTranscriptionHandlers(container);
  registerAIHandlers(container);
  registerKnowledgeHandlers(container);
  protocol.handle('lecta-media', (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'recording') return new Response('Not found', { status: 404 });
    const sessionId = url.pathname.slice(1);
    return net.fetch(
      pathToFileURL(container.recordings.getRecordingFilePath(sessionId)).toString(),
    );
  });
  electronSession.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (process.platform !== 'win32' || !request.userGesture || !request.audioRequested) {
      callback({});
      return;
    }
    void desktopCapturer
      .getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
      .then(([source]) => callback(source ? { video: source, audio: 'loopback' } : {}))
      .catch(() => callback({}));
  });
  electronSession.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      callback(permission === 'media' && isTrustedRendererUrl(webContents.getURL()));
    },
  );
  electronSession.defaultSession.setPermissionCheckHandler(
    (webContents, permission) =>
      permission === 'media' && isTrustedRendererUrl(webContents?.getURL() ?? ''),
  );
  createWindow();
  app.on('before-quit', () => {
    unsubscribeTranscription();
    container.transcriptionQueue.shutdown();
    void container.knowledgeWorker.shutdown();
    container.transcriptionStore.close();
    container.structuredNotes.close();
    container.knowledgeStore.close();
    container.sessions.close();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function isTrustedRendererUrl(value: string): boolean {
  try {
    const candidate = new URL(value);
    const devUrl = process.env['VITE_DEV_SERVER_URL'];
    if (devUrl && candidate.origin === new URL(devUrl).origin) return true;
    const renderer = pathToFileURL(path.join(directory, '../../renderer/index.html'));
    return candidate.protocol === 'file:' && candidate.pathname === renderer.pathname;
  } catch {
    return false;
  }
}
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
