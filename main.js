const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { machineIdSync } = require('node-machine-id');
const { autoUpdater } = require('electron-updater');
const https = require('https');

// ============================================================
// 설정
// ============================================================
const APP_URL = 'https://mirae-bizon-analyzer.maclub7.workers.dev';
const LICENSE_API = 'https://mirae-bizon-analyzer.maclub7.workers.dev/api/license';
const APP_NAME = '미래비즈온 AI 타지역서비스 분석툴';
const APP_VERSION = app.getVersion ? app.getVersion() : '1.0.0';

let mainWindow = null;
let splashWindow = null;
let licenseWindow = null;
let machineId = '';

try { machineId = machineIdSync(); } catch(e) { machineId = 'unknown-' + Date.now(); }

// ============================================================
// 자동 업데이트 설정
// ============================================================
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = require('electron-log');

autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(
      `document.title = '업데이트 다운로드 중... v${info.version}'`
    );
  }
});

autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '업데이트 준비 완료',
    message: `새 버전 v${info.version}이 다운로드되었습니다.`,
    detail: '지금 재시작하여 업데이트를 적용하시겠습니까?',
    buttons: ['지금 재시작', '나중에'],
    defaultId: 0
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (err) => {
  console.log('Auto-update error:', err);
});

// ============================================================
// 라이선스 API 호출
// ============================================================
function callLicenseAPI(action, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ action, ...data, machineId, appVersion: APP_VERSION });
    const url = new URL(LICENSE_API);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { reject(new Error('Invalid response')); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ============================================================
// 라이선스 저장/불러오기 (로컬)
// ============================================================
const Store = require('electron-store');
const store = new Store({ name: 'mirae-license' });

function getSavedLicense() {
  return store.get('licenseKey', '');
}

function saveLicense(key) {
  store.set('licenseKey', key);
}

// ============================================================
// 스플래시 화면
// ============================================================
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480, height: 360, frame: false, transparent: true,
    resizable: false, alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  splashWindow.loadFile('splash.html');
  splashWindow.center();
}

// ============================================================
// 라이선스 입력 화면
// ============================================================
function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 520, height: 440, frame: false, resizable: false,
    transparent: true, center: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  licenseWindow.loadFile('license.html');
  
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ============================================================
// 메인 윈도우
// ============================================================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 900, minWidth: 800, minHeight: 600,
    title: APP_NAME, icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const menuTemplate = [
    { label: '파일', submenu: [
      { label: '새로고침', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.webContents.reload() },
      { label: '강제 새로고침', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow.webContents.reloadIgnoringCache() },
      { type: 'separator' },
      { label: '종료', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
    ]},
    { label: '보기', submenu: [
      { label: '확대', accelerator: 'CmdOrCtrl+=', click: () => mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5) },
      { label: '축소', accelerator: 'CmdOrCtrl+-', click: () => mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5) },
      { label: '원래 크기', accelerator: 'CmdOrCtrl+0', click: () => mainWindow.webContents.setZoomLevel(0) },
      { type: 'separator' },
      { label: '전체화면', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) }
    ]},
    { label: '도움말', submenu: [
      { label: `v${APP_VERSION} (Beta)`, enabled: false },
      { type: 'separator' },
      { label: '미래비즈온 홈페이지', click: () => shell.openExternal('https://miraebizad.com') },
      { label: '카카오톡 상담', click: () => shell.openExternal('https://pf.kakao.com/_xgsLbn/chat') },
      { label: '전화 상담 (1600-0251)', click: () => shell.openExternal('tel:1600-0251') },
      { type: 'separator' },
      { label: '업데이트 확인', click: () => autoUpdater.checkForUpdates() },
      { label: '개발자 도구', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }
    ]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  mainWindow.loadURL(APP_URL);

  mainWindow.webContents.on('did-finish-load', () => {
    if (licenseWindow && !licenseWindow.isDestroyed()) { licenseWindow.close(); licenseWindow = null; }
    if (splashWindow && !splashWindow.isDestroyed()) { splashWindow.close(); splashWindow = null; }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on('did-fail-load', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    if (licenseWindow && !licenseWindow.isDestroyed()) licenseWindow.close();
    mainWindow.show();
    dialog.showMessageBox(mainWindow, {
      type: 'error', title: '연결 오류',
      message: '서버에 연결할 수 없습니다.',
      detail: '인터넷 연결을 확인 후 Ctrl+R로 새로고침하세요.',
      buttons: ['확인']
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('mirae-bizon-analyzer')) {
      shell.openExternal(url); return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // 자동 업데이트 체크
  setTimeout(() => { autoUpdater.checkForUpdatesAndNotify(); }, 5000);
}

// ============================================================
// IPC: 라이선스 검증 (렌더러 → 메인)
// ============================================================
ipcMain.handle('license:activate', async (event, key) => {
  try {
    const result = await callLicenseAPI('activate', { key });
    if (result.success) saveLicense(key);
    return result;
  } catch(e) {
    return { success: false, message: '서버 연결 실패. 인터넷을 확인하세요.' };
  }
});

ipcMain.handle('license:verify', async (event, key) => {
  try {
    return await callLicenseAPI('verify', { key });
  } catch(e) {
    // 오프라인이면 로컬 키 존재만으로 허용 (관대한 정책)
    return { success: true, message: '오프라인 모드 (제한적)', offline: true };
  }
});

ipcMain.handle('license:getMachineId', () => machineId);

// ============================================================
// 앱 시작
// ============================================================
app.whenReady().then(async () => {
  createSplash();
  
  const savedKey = getSavedLicense();
  
  if (savedKey) {
    // 저장된 키 검증
    try {
      const result = await callLicenseAPI('verify', { key: savedKey });
      if (result.success) {
        createMainWindow();
        return;
      }
      // 만료 또는 다른 PC
      createLicenseWindow();
    } catch(e) {
      // 오프라인 → 관대하게 허용
      createMainWindow();
    }
  } else {
    createLicenseWindow();
  }
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!mainWindow) createMainWindow(); });

// 라이선스 인증 후 앱 시작
ipcMain.on('license:launch', () => {
  if (licenseWindow && !licenseWindow.isDestroyed()) {
    licenseWindow.close();
    licenseWindow = null;
  }
  createMainWindow();
});
