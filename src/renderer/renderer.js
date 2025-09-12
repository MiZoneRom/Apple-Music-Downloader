const { ipcRenderer } = require('electron');

class AppleMusicDownloader {
    constructor() {
        this.downloadHistory = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
        this.currentDownload = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkGamdlStatus();
        this.loadDownloadHistory();
        this.setDefaultDownloadPath();
    }

    bindEvents() {
        // 选择文件夹按钮
        document.getElementById('select-folder-btn').addEventListener('click', () => {
            this.selectDownloadFolder();
        });

        // 下载按钮
        document.getElementById('download-btn').addEventListener('click', () => {
            this.startDownload();
        });

        // URL 输入框变化
        document.getElementById('music-url').addEventListener('input', () => {
            this.validateForm();
        });

        // 监听下载进度
        ipcRenderer.on('download-progress', (event, data) => {
            this.handleDownloadProgress(data);
        });
    }

    async checkGamdlStatus() {
        const statusElement = document.getElementById('gamdl-status-text');
        statusElement.textContent = '检查中...';
        statusElement.className = 'status-value checking';

        try {
            const result = await ipcRenderer.invoke('check-gamdl');
            if (result.installed) {
                statusElement.textContent = '已安装 ✓';
                statusElement.className = 'status-value installed';
            } else {
                statusElement.textContent = '未安装 ✗';
                statusElement.className = 'status-value not-installed';
                this.showNotification('gamdl 未安装，请先安装 gamdl 库', 'error');
            }
        } catch (error) {
            statusElement.textContent = '检查失败 ✗';
            statusElement.className = 'status-value not-installed';
            this.showNotification('检查 gamdl 状态失败', 'error');
        }
    }

    async setDefaultDownloadPath() {
        try {
            const defaultPath = await ipcRenderer.invoke('get-default-download-path');
            document.getElementById('output-path').value = defaultPath;
            this.validateForm();
        } catch (error) {
            console.error('设置默认下载路径失败:', error);
        }
    }

    async selectDownloadFolder() {
        try {
            const folderPath = await ipcRenderer.invoke('select-download-folder');
            if (folderPath) {
                document.getElementById('output-path').value = folderPath;
                this.validateForm();
            }
        } catch (error) {
            this.showNotification('选择文件夹失败', 'error');
        }
    }

    validateForm() {
        const url = document.getElementById('music-url').value;
        const outputPath = document.getElementById('output-path').value;
        const downloadBtn = document.getElementById('download-btn');

        const isValid = url && outputPath && this.isValidAppleMusicUrl(url);
        downloadBtn.disabled = !isValid;

        return isValid;
    }

    isValidAppleMusicUrl(url) {
        const appleMusicRegex = /^https:\/\/music\.apple\.com\/.+/;
        return appleMusicRegex.test(url);
    }

    async startDownload() {
        if (!this.validateForm()) {
            this.showNotification('请填写完整的下载信息', 'error');
            return;
        }

        const url = document.getElementById('music-url').value;
        const outputPath = document.getElementById('output-path').value;
        const quality = document.getElementById('quality-select').value;

        this.currentDownload = {
            url,
            outputPath,
            quality,
            startTime: new Date(),
            status: 'downloading'
        };

        this.showProgressSection();
        this.updateDownloadButton(true);
        this.addToProgressLog('开始下载...');

        try {
            const result = await ipcRenderer.invoke('download-music', {
                url,
                outputPath,
                quality
            });

            if (result.success) {
                this.handleDownloadSuccess(result);
            } else {
                this.handleDownloadError(result);
            }
        } catch (error) {
            this.handleDownloadError(error);
        } finally {
            this.updateDownloadButton(false);
        }
    }

    showProgressSection() {
        document.getElementById('progress-section').style.display = 'block';
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('progress-text').textContent = '准备下载...';
        document.getElementById('progress-log').innerHTML = '';
    }

    updateDownloadButton(loading) {
        const downloadBtn = document.getElementById('download-btn');
        const btnText = downloadBtn.querySelector('.btn-text');
        const btnLoading = downloadBtn.querySelector('.btn-loading');

        if (loading) {
            downloadBtn.classList.add('loading');
            downloadBtn.disabled = true;
        } else {
            downloadBtn.classList.remove('loading');
            downloadBtn.disabled = false;
        }
    }

    handleDownloadProgress(data) {
        const progressLog = document.getElementById('progress-log');
        const logEntry = document.createElement('div');
        logEntry.textContent = data.data;
        progressLog.appendChild(logEntry);
        progressLog.scrollTop = progressLog.scrollHeight;

        // 简单的进度估算（基于输出内容）
        if (data.data.includes('Downloading') || data.data.includes('下载')) {
            const currentWidth = parseInt(document.getElementById('progress-fill').style.width) || 0;
            const newWidth = Math.min(currentWidth + 10, 90);
            document.getElementById('progress-fill').style.width = newWidth + '%';
            document.getElementById('progress-text').textContent = '下载中...';
        }
    }

    handleDownloadSuccess(result) {
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('progress-text').textContent = '下载完成！';
        this.addToProgressLog('下载成功完成！');

        // 添加到下载历史
        const historyItem = {
            ...this.currentDownload,
            status: 'success',
            endTime: new Date(),
            message: result.message
        };
        this.addToDownloadHistory(historyItem);

        this.showNotification('下载完成！', 'success');
        this.resetForm();
    }

    handleDownloadError(error) {
        document.getElementById('progress-text').textContent = '下载失败';
        this.addToProgressLog(`错误: ${error.message || error.error || '未知错误'}`);

        // 添加到下载历史
        const historyItem = {
            ...this.currentDownload,
            status: 'error',
            endTime: new Date(),
            message: error.message || '下载失败'
        };
        this.addToDownloadHistory(historyItem);

        this.showNotification('下载失败', 'error');
    }

    addToProgressLog(message) {
        const progressLog = document.getElementById('progress-log');
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        progressLog.appendChild(logEntry);
        progressLog.scrollTop = progressLog.scrollHeight;
    }

    addToDownloadHistory(item) {
        this.downloadHistory.unshift(item);
        // 只保留最近 50 条记录
        if (this.downloadHistory.length > 50) {
            this.downloadHistory = this.downloadHistory.slice(0, 50);
        }
        localStorage.setItem('downloadHistory', JSON.stringify(this.downloadHistory));
        this.loadDownloadHistory();
    }

    loadDownloadHistory() {
        const historyList = document.getElementById('history-list');
        
        if (this.downloadHistory.length === 0) {
            historyList.innerHTML = '<div class="history-empty">暂无下载记录</div>';
            return;
        }

        historyList.innerHTML = this.downloadHistory.map(item => `
            <div class="history-item">
                <div class="history-info">
                    <div class="history-title">${this.extractTitleFromUrl(item.url)}</div>
                    <div class="history-details">
                        ${item.quality} | ${new Date(item.startTime).toLocaleString()}
                    </div>
                </div>
                <div class="history-status ${item.status}">
                    ${item.status === 'success' ? '成功' : '失败'}
                </div>
            </div>
        `).join('');
    }

    extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            return pathParts[pathParts.length - 1] || '未知标题';
        } catch {
            return '未知标题';
        }
    }

    resetForm() {
        document.getElementById('music-url').value = '';
        document.getElementById('output-path').value = '';
        document.getElementById('quality-select').value = 'high';
        this.validateForm();
    }

    showNotification(message, type = 'info') {
        // 简单的通知实现
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new AppleMusicDownloader();
});

// 添加 CSS 动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
