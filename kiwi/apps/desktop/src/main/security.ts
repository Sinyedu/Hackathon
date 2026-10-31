import { app, type WebContents } from 'electron';

/** Applied to every webContents: no new windows, no navigation away from the bundled UI. */
export function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event) => event.preventDefault());
}

export function installGlobalHardening(): void {
  app.on('web-contents-created', (_event, contents) => hardenWebContents(contents));
}
