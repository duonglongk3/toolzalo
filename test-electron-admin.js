// Script để test admin groups qua Electron IPC
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron', 'preload.js')
    }
  });

  // Load a simple HTML page for testing
  mainWindow.loadFile('test-admin-groups.html');
}

// Test IPC handler
ipcMain.handle('test-admin-groups', async () => {
  try {
    console.log('🔥 Testing admin groups via Electron...');
    
    // Import the main process handlers
    require('./electron/main.ts');
    
    // Test the zalo-test-groups-admin handler
    const result = await ipcMain.handle('zalo-test-groups-admin');
    
    console.log('📊 Test result:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Test error:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
