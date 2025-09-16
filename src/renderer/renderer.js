const { ipcRenderer } = require("electron");

const { createApp, ref, computed, onMounted, nextTick } = Vue;

createApp({
  setup() {
    // 响应式数据
    const musicUrl = ref("");
    const outputPath = ref("");
    const isFormValid = ref(false);
    const isDownloading = ref(false);
    const showProgress = ref(false);
    const showStats = ref(false);

    // gamdl 状态
    const gamdlStatusText = ref("检查中...");
    const gamdlStatusClass = ref("checking");

    // 下载进度
    const progressPercentage = ref(0);
    const progressText = ref("准备下载...");
    /** @type {Ref<string[]>} */
    const progressLogs = ref([]);
    const progressLog = ref(null);

    // 当前歌曲信息
    const currentSong = ref({
      title: "",
      progress: "",
    });

    // 下载统计
    const downloadStats = ref({
      fileSize: "-",
      speed: "-",
      eta: "-",
      elapsed: "-",
    });

    // 下载状态
    const downloadStartTime = ref(null);
    const currentSongInfo = ref({
      title: "",
      trackNumber: 0,
      totalTracks: 0,
      urlNumber: 0,
      totalUrls: 0,
    });

    // 计算属性
    const isFormValidComputed = computed(() => {
      return (
        musicUrl.value &&
        outputPath.value &&
        isValidAppleMusicUrl(musicUrl.value)
      );
    });

    // 方法
    const isValidAppleMusicUrl = (url) => {
      const appleMusicRegex = /^https:\/\/music\.apple\.com\/.+/;
      return appleMusicRegex.test(url);
    };

    const validateForm = () => {
      isFormValid.value = isFormValidComputed.value;
    };

    const checkGamdlStatus = async () => {
      gamdlStatusText.value = "检查中...";
      gamdlStatusClass.value = "checking";

      try {
        const result = await ipcRenderer.invoke("check-gamdl");
        if (result.installed) {
          gamdlStatusText.value = "已安装 ✓";
          gamdlStatusClass.value = "installed";
        } else {
          gamdlStatusText.value = "未安装 ✗";
          gamdlStatusClass.value = "not-installed";
          showNotification("gamdl 未安装，请先安装 gamdl 库", "error");
        }
      } catch (error) {
        gamdlStatusText.value = "检查失败 ✗";
        gamdlStatusClass.value = "not-installed";
        showNotification("检查 gamdl 状态失败", "error");
      }
    };

    const setDefaultDownloadPath = async () => {
      try {
        const defaultPath = await ipcRenderer.invoke(
          "get-default-download-path"
        );
        outputPath.value = defaultPath;
        validateForm();
      } catch (error) {
        console.error("设置默认下载路径失败:", error);
      }
    };

    const selectDownloadFolder = async () => {
      try {
        const folderPath = await ipcRenderer.invoke("select-download-folder");
        if (folderPath) {
          outputPath.value = folderPath;
          validateForm();
        }
      } catch (error) {
        showNotification("选择文件夹失败", "error");
      }
    };

    const startDownload = async () => {
      if (!isFormValid.value) {
        showNotification("请填写完整的下载信息", "error");
        return;
      }

      isDownloading.value = true;
      showProgress.value = true;
      showStats.value = true;
      downloadStartTime.value = new Date();

      // 重置状态
      progressPercentage.value = 0;
      progressText.value = "开始下载歌曲...";
      progressLogs.value = [];
      currentSong.value = { title: "", progress: "" };
      currentSongInfo.value = {
        title: "",
        trackNumber: 0,
        totalTracks: 0,
        urlNumber: 0,
        totalUrls: 0,
      };

      try {
        const result = await ipcRenderer.invoke("download-music", {
          url: musicUrl.value,
          outputPath: outputPath.value,
        });

        if (result.success) {
          handleDownloadSuccess(result);
        } else {
          handleDownloadError(result);
        }
      } catch (error) {
        handleDownloadError(error);
      } finally {
        isDownloading.value = false;
      }
    };

    const handleDownloadProgress = (data) => {
      if (progressLog.value.length > 1000) {
        progressLogs.value.splice(0, 500);
      }

      progressLogs.value.push(data.data);

      nextTick(() => {
        progressLog.value.scrollTop = progressLog.value.scrollHeight;
      });

      // 解析下载进度信息
      parseDownloadProgress(data.data);
    };

    const parseDownloadProgress = (logText) => {
      // 匹配下载进度模式：[download] XX.X% of ~ XX.XXMiB at XX.XXMiB/s ETA XX:XX (frag X/XX)
      const progressMatch = logText.match(
        /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~\s+([\d.]+)([KMGT]?i?B)\s+at\s+([\d.]+)([KMGT]?i?B\/s)\s+ETA\s+([\d:]+|Unknown)\s+\(frag\s+(\d+)\/(\d+)\)/
      );

      if (progressMatch) {
        const percentage = parseFloat(progressMatch[1]);
        const totalSize = progressMatch[2] + progressMatch[3];
        const speed = progressMatch[4] + progressMatch[5];
        const eta = progressMatch[6];
        const currentFragment = parseInt(progressMatch[7]);
        const totalFragments = parseInt(progressMatch[8]);

        // 更新进度条
        progressPercentage.value = percentage;

        // 更新进度文本
        let progressTextValue = `下载中... ${percentage.toFixed(1)}%`;
        if (eta !== "Unknown") {
          progressTextValue += ` | 剩余时间: ${eta}`;
        }
        progressTextValue += ` | 速度: ${speed}`;
        if (totalFragments > 1) {
          progressTextValue += ` | 片段: ${currentFragment}/${totalFragments}`;
        }
        progressText.value = progressTextValue;

        // 更新统计信息
        updateDownloadStats(percentage, totalSize, speed, eta);

        // 更新歌曲进度（如果有歌曲信息）
        if (currentSongInfo.value.title) {
          updateSongProgress(`下载中 ${percentage.toFixed(1)}%`);
        }
      }

      // 匹配下载完成
      if (logText.includes("100% of") && logText.includes("in")) {
        const completedMatch = logText.match(
          /100%\s+of\s+([\d.]+)([KMGT]?i?B)\s+in\s+([\d:]+)\s+at\s+([\d.]+)([KMGT]?i?B\/s)/
        );
        if (completedMatch) {
          const totalSize = completedMatch[1] + completedMatch[2];
          const duration = completedMatch[3];
          const avgSpeed = completedMatch[4] + completedMatch[5];

          progressPercentage.value = 100;
          progressText.value = `下载完成! 大小: ${totalSize} | 用时: ${duration} | 平均速度: ${avgSpeed}`;

          // 更新最终统计信息
          updateFinalStats(totalSize, duration, avgSpeed);
        }
      }

      // 匹配开始下载
      if (logText.includes("[INFO") && logText.includes("Downloading song")) {
        progressPercentage.value = 0;
        progressText.value = "开始下载歌曲...";
      }

      // 匹配歌曲信息 - 格式: (Track X/Y from URL A/B) "Song Title"
      const songInfoMatch = logText.match(
        /\(Track\s+(\d+)\/(\d+)\s+from\s+URL\s+(\d+)\/(\d+)\)\s+"([^"]+)"/
      );
      if (songInfoMatch) {
        currentSongInfo.value = {
          title: songInfoMatch[5],
          trackNumber: parseInt(songInfoMatch[1]),
          totalTracks: parseInt(songInfoMatch[2]),
          urlNumber: parseInt(songInfoMatch[3]),
          totalUrls: parseInt(songInfoMatch[4]),
        };
        updateSongInfo();
      }

      // 匹配下载完成信息
      if (logText.includes("Download completed successfully")) {
        updateSongProgress("下载完成");
      }
    };

    const updateDownloadStats = (percentage, totalSize, speed, eta) => {
      downloadStats.value.fileSize = totalSize;
      downloadStats.value.speed = speed;
      downloadStats.value.eta = eta === "Unknown" ? "计算中..." : eta;

      if (downloadStartTime.value) {
        const elapsed = Math.floor(
          (new Date() - downloadStartTime.value) / 1000
        );
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        downloadStats.value.elapsed = `${minutes}:${seconds
          .toString()
          .padStart(2, "0")}`;
      }
    };

    const updateFinalStats = (totalSize, duration, avgSpeed) => {
      downloadStats.value.fileSize = totalSize;
      downloadStats.value.speed = avgSpeed;
      downloadStats.value.eta = "完成";

      if (downloadStartTime.value) {
        const elapsed = Math.floor(
          (new Date() - downloadStartTime.value) / 1000
        );
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        downloadStats.value.elapsed = `${minutes}:${seconds
          .toString()
          .padStart(2, "0")}`;
      }
    };

    const updateSongInfo = () => {
      if (currentSongInfo.value.title) {
        currentSong.value.title = currentSongInfo.value.title;

        let progressTextValue = "";
        if (currentSongInfo.value.totalTracks > 1) {
          progressTextValue = `第 ${currentSongInfo.value.trackNumber}/${currentSongInfo.value.totalTracks} 首歌曲`;
        }
        if (currentSongInfo.value.totalUrls > 1) {
          progressTextValue += progressTextValue
            ? ` | 第 ${currentSongInfo.value.urlNumber}/${currentSongInfo.value.totalUrls} 个链接`
            : `第 ${currentSongInfo.value.urlNumber}/${currentSongInfo.value.totalUrls} 个链接`;
        }

        currentSong.value.progress = progressTextValue || "正在下载...";
      }
    };

    const updateSongProgress = (status) => {
      if (currentSongInfo.value.title) {
        let progressTextValue = status;
        if (currentSongInfo.value.totalTracks > 1) {
          progressTextValue += ` - 第 ${currentSongInfo.value.trackNumber}/${currentSongInfo.value.totalTracks} 首歌曲`;
        }
        if (currentSongInfo.value.totalUrls > 1) {
          progressTextValue += ` (第 ${currentSongInfo.value.urlNumber}/${currentSongInfo.value.totalUrls} 个链接)`;
        }
        currentSong.value.progress = progressTextValue;
      }
    };

    const handleDownloadSuccess = (result) => {
      progressPercentage.value = 100;
      progressText.value = "下载完成！";
      progressLogs.value.push("下载成功完成！");
      showNotification("下载完成！", "success");
    };

    const handleDownloadError = (error) => {
      progressText.value = "下载失败";

      progressLogs.value.push(
        `错误: 下载失败的歌曲: ${error.errorUrls.join("\n")}`
      );

      musicUrl.value = error.errorUrls.join("\n");

      showNotification("下载失败", "error");
    };

    const showNotification = (message, type = "info") => {
      // 简单的通知实现
      const notification = document.createElement("div");
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
        background: ${
          type === "success"
            ? "#28a745"
            : type === "error"
            ? "#dc3545"
            : "#17a2b8"
        };
      `;
      notification.textContent = message;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.remove();
      }, 3000);
    };

    // 窗口控制方法
    const minimizeWindow = () => {
      ipcRenderer.invoke("window-minimize");
    };

    const maximizeWindow = () => {
      ipcRenderer.invoke("window-maximize");
    };

    const closeWindow = () => {
      ipcRenderer.invoke("window-close");
    };

    // 生命周期
    onMounted(() => {
      checkGamdlStatus();
      setDefaultDownloadPath();

      // 监听下载进度
      ipcRenderer.on("download-progress", (event, data) => {
        handleDownloadProgress(data);
      });
    });

    return {
      progressLog,

      // 响应式数据
      musicUrl,
      outputPath,
      isFormValid: isFormValidComputed,
      isDownloading,
      showProgress,
      showStats,
      gamdlStatusText,
      gamdlStatusClass,
      progressPercentage,
      progressText,
      progressLogs,
      currentSong,
      downloadStats,

      // 方法
      validateForm,
      selectDownloadFolder,
      startDownload,
      minimizeWindow,
      maximizeWindow,
      closeWindow,
    };
  },
}).mount("#app");
