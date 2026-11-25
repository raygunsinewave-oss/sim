// DJSIM by Raygun — Electron main process
const { app, BrowserWindow, protocol, session, systemPreferences, ipcMain, Menu, shell, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('DJSIM');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.txt': 'text/plain'
};

const SRC_ROOT = path.join(__dirname, 'src');
let win = null;

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const filePath = path.normalize(path.join(SRC_ROOT, rel));
      if (!filePath.startsWith(SRC_ROOT)) return new Response('Forbidden', { status: 403 });
      const data = await fs.promises.readFile(filePath);
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      return new Response(data, { headers: { 'content-type': type } });
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: 'DJSIM',
      submenu: [
        { role: 'about', label: 'About DJSIM by Raygun' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide DJSIM' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit DJSIM' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Audio Files…', accelerator: 'CmdOrCtrl+O', click: () => win && win.webContents.send('menu', 'open-files') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Show',
      submenu: [
        { label: 'Next Preset', accelerator: 'CmdOrCtrl+Right', click: () => win && win.webContents.send('menu', 'next-preset') },
        { label: 'Previous Preset', accelerator: 'CmdOrCtrl+Left', click: () => win && win.webContents.send('menu', 'prev-preset') },
        { label: 'Toggle Interface', accelerator: 'Tab', click: () => win && win.webContents.send('menu', 'toggle-ui') },
        { label: 'Auto-VJ Mode', accelerator: 'CmdOrCtrl+J', click: () => win && win.webContents.send('menu', 'auto-vj') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' }, { role: 'resetZoom' },
        { type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }
      ]
    },
    { role: 'windowMenu' },
    { role: 'help', submenu: [{ label: 'DJSIM on GitHub', click: () => shell.openExternal('https://github.com/raygunsinewave-oss/sim') }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 960, minWidth: 1024, minHeight: 640,
    title: 'DJSIM by Raygun',
    backgroundColor: '#000000',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.loadURL('app://djsim/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  registerAppProtocol();
  buildMenu();

  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['media', 'audioCapture', 'display-capture', 'fullscreen', 'clipboard-sanitized-write'].includes(permission));
  });
  ses.setPermissionCheckHandler(() => true);

  // System-audio capture (experimental): share the primary screen with loopback audio.
  try {
    ses.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        callback({ video: sources[0], audio: 'loopback' });
      } catch (e) { callback({}); }
    });
  } catch (e) { /* older Electron */ }

  ipcMain.handle('request-mic', async () => {
    if (process.platform !== 'darwin') return true;
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      if (status === 'granted') return true;
      return await systemPreferences.askForMediaAccess('microphone');
    } catch (e) { return false; }
  });
  ipcMain.handle('app-version', () => app.getVersion());

  app.setAboutPanelOptions({
    applicationName: 'DJSIM', applicationVersion: app.getVersion(),
    copyright: 'DJSIM by Raygun', credits: '3D DJ-set visualizer & crowd simulator'
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
