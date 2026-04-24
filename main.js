const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const APP_URL = 'https://mirae-bizon-analyzer.maclub7.workers.dev';
const LICENSE_API = 'https://mirae-bizon-analyzer.maclub7.workers.dev/api/license';
const APP_NAME = '미래비즈온 AI 타지역서비스 분석툴';
const APP_VERSION = '1.0.0';

let mainWindow = null, splashWindow = null, licenseWindow = null;

// Machine ID (하드웨어 고유값)
function getMachineId() {
  try {
    const interfaces = require('os').networkInterfaces();
    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          return crypto.createHash('sha256').update(iface.mac + require('os').hostname()).digest('hex').substring(0, 32);
        }
      }
    }
  } catch(e) {}
  return crypto.createHash('sha256').update(require('os').hostname() + require('os').userInfo().username).digest('hex').substring(0, 32);
}
const machineId = getMachineId();

// 로컬 저장 (라이선스 키)
const storePath = path.join(app.getPath('userData'), 'license.json');
function getSavedLicense() {
  try { return JSON.parse(fs.readFileSync(storePath, 'utf8')).key || ''; } catch(e) { return ''; }
}
function saveLicense(key) {
  try { fs.writeFileSync(storePath, JSON.stringify({ key })); } catch(e) {}
}

// API 호출
function callLicenseAPI(action, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ action, ...data, machineId, appVersion: APP_VERSION });
    const url = new URL(LICENSE_API);
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(postData);
    req.end();
  });
}

// 스플래시
function createSplash() {
  splashWindow = new BrowserWindow({ width:480, height:360, frame:false, transparent:true, resizable:false, alwaysOnTop:true, skipTaskbar:true, webPreferences:{nodeIntegration:false,contextIsolation:true} });
  splashWindow.loadFile('splash.html');
  splashWindow.center();
}

// 라이선스 화면
function createLicenseWindow(msg) {
  licenseWindow = new BrowserWindow({ width:520, height:460, frame:false, resizable:false, transparent:true, center:true, webPreferences:{nodeIntegration:false,contextIsolation:true,preload:path.join(__dirname,'preload.js')} });
  licenseWindow.loadFile('license.html');
  if (splashWindow && !splashWindow.isDestroyed()) { splashWindow.close(); splashWindow = null; }
}

// 메인 윈도우
function createMainWindow() {
  mainWindow = new BrowserWindow({ width:1280, height:900, minWidth:800, minHeight:600, title:APP_NAME, icon:path.join(__dirname,'assets','icon.png'), show:false, webPreferences:{nodeIntegration:false,contextIsolation:true,preload:path.join(__dirname,'preload.js')} });
  
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label:'파일', submenu:[
      { label:'새로고침', accelerator:'CmdOrCtrl+R', click:()=>mainWindow.webContents.reload() },
      { label:'강제 새로고침', accelerator:'CmdOrCtrl+Shift+R', click:()=>mainWindow.webContents.reloadIgnoringCache() },
      { type:'separator' },
      { label:'종료', accelerator:'CmdOrCtrl+Q', click:()=>app.quit() }
    ]},
    { label:'보기', submenu:[
      { label:'확대', accelerator:'CmdOrCtrl+=', click:()=>mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel()+0.5) },
      { label:'축소', accelerator:'CmdOrCtrl+-', click:()=>mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel()-0.5) },
      { label:'원래 크기', accelerator:'CmdOrCtrl+0', click:()=>mainWindow.webContents.setZoomLevel(0) },
      { type:'separator' },
      { label:'전체화면', accelerator:'F11', click:()=>mainWindow.setFullScreen(!mainWindow.isFullScreen()) }
    ]},
    { label:'도움말', submenu:[
      { label:'v'+APP_VERSION+' (Beta)', enabled:false },
      { type:'separator' },
      { label:'미래비즈온 홈페이지', click:()=>shell.openExternal('https://miraebizad.com') },
      { label:'카카오톡 상담', click:()=>shell.openExternal('https://pf.kakao.com/_xgsLbn/chat') },
      { label:'전화 상담 (1600-0251)', click:()=>shell.openExternal('tel:1600-0251') },
      { type:'separator' },
      { label:'개발자 도구', accelerator:'F12', click:()=>mainWindow.webContents.toggleDevTools() }
    ]}
  ]));

  mainWindow.loadURL(APP_URL);
  mainWindow.webContents.on('did-finish-load', () => {
    if (licenseWindow && !licenseWindow.isDestroyed()) { licenseWindow.close(); licenseWindow = null; }
    if (splashWindow && !splashWindow.isDestroyed()) { splashWindow.close(); splashWindow = null; }
    mainWindow.show(); mainWindow.focus();
  });
  mainWindow.webContents.on('did-fail-load', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    if (licenseWindow && !licenseWindow.isDestroyed()) licenseWindow.close();
    mainWindow.show();
    dialog.showMessageBox(mainWindow, { type:'error', title:'연결 오류', message:'서버에 연결할 수 없습니다.', detail:'인터넷 연결 확인 후 Ctrl+R로 새로고침하세요.', buttons:['확인'] });
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('mirae-bizon-analyzer')) { shell.openExternal(url); return { action:'deny' }; }
    return { action:'allow' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// IPC
ipcMain.handle('license:activate', async (event, key) => {
  try {
    const result = await callLicenseAPI('activate', { key });
    if (result.success) saveLicense(key);
    return result;
  } catch(e) { return { success: false, message: '서버 연결 실패. 인터넷을 확인하세요.' }; }
});
ipcMain.handle('license:verify', async (event, key) => {
  try { return await callLicenseAPI('verify', { key }); }
  catch(e) { return { success: true, message: '오프라인 모드', offline: true }; }
});
ipcMain.handle('license:getMachineId', () => machineId);
ipcMain.on('license:launch', () => {
  if (licenseWindow && !licenseWindow.isDestroyed()) { licenseWindow.close(); licenseWindow = null; }
  createMainWindow();
});

// 앱 시작
app.whenReady().then(async () => {
  createSplash();
  const savedKey = getSavedLicense();
  if (savedKey) {
    try {
      const result = await callLicenseAPI('verify', { key: savedKey });
      if (result.success) { createMainWindow(); return; }
    } catch(e) { createMainWindow(); return; } // 오프라인 → 허용
  }
  createLicenseWindow();
});

app.on('window-all-closed', () => app.quit());
