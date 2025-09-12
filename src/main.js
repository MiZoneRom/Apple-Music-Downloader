const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false, // 移除窗口边框和标题栏
        titleBarStyle: 'hidden', // 隐藏标题栏
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        title: 'Apple Music Downloader',
        backgroundColor: '#667eea', // 设置背景色以匹配应用主题
        show: false // 先不显示，等加载完成后再显示
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    // 页面加载完成后显示窗口
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // 开发模式下打开开发者工具
    // if (process.argv.includes('--dev')) {
    //     mainWindow.webContents.openDevTools();
    // }
}

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

// 处理下载请求
ipcMain.handle('download-music', async (event, { url, outputPath, quality }) => {
    return new Promise((resolve, reject) => {
        try {
            const cookiesPath = path.join(__dirname, "../cookies.txt");
            // 使用 gamdl 进行下载
            const gamdlProcess = spawn('python', [
                "-m",
                "gamdl",
                url,
                "--cookies-path", cookiesPath,
                "--output-path", outputPath || path.join(__dirname, "../download"),
                "--language", "zh-CN"
            ], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            gamdlProcess.stdout.on('data', (data) => {
                output += data.toString();
                // 发送进度更新到渲染进程
                mainWindow.webContents.send('download-progress', {
                    type: 'progress',
                    data: data.toString()
                });
            });

            gamdlProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                mainWindow.webContents.send('download-progress', {
                    type: 'error',
                    data: data.toString()
                });
            });

            gamdlProcess.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        message: '下载完成',
                        output: output
                    });
                } else {
                    reject({
                        success: false,
                        message: '下载失败',
                        error: errorOutput
                    });
                }
            });

            gamdlProcess.on('error', (error) => {
                reject({
                    success: false,
                    message: '启动下载进程失败',
                    error: error.message
                });
            });

        } catch (error) {
            reject({
                success: false,
                message: '下载过程中发生错误',
                error: error.message
            });
        }
    });
});

// 选择下载目录
ipcMain.handle('select-download-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: '选择下载目录',
        defaultPath: path.join(__dirname, '../download')
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// 获取默认下载路径
ipcMain.handle('get-default-download-path', async () => {
    const defaultPath = path.join(__dirname, '../download');
    
    // 确保下载目录存在
    if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath, { recursive: true });
    }
    
    return defaultPath;
});

// 检查 gamdl 是否安装
ipcMain.handle('check-gamdl', async () => {
    return new Promise((resolve) => {
        const gamdlProcess = spawn('python', [
            "-m",
            "gamdl",
            '--version'
        ], { stdio: 'pipe' });

        gamdlProcess.on('close', (code) => {
            resolve({ installed: code === 0 });
        });

        gamdlProcess.on('error', () => {
            resolve({ installed: false });
        });
    });
});

// 窗口控制按钮
ipcMain.handle('window-minimize', () => {
    mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.handle('window-close', () => {
    mainWindow.close();
});
