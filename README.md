# 🎵 Apple Music Downloader

一个基于 Electron 和 gamdl 的 Apple Music 下载器，提供美观的图形界面来下载 Apple Music 音乐。

## ✨ 功能特性

- 🎨 现代化的用户界面
- 🎵 支持 Apple Music 链接下载
- 🎚️ 多种音质选择（高/中/低质量）
- 📁 默认下载到程序目录的 download 文件夹
- 📁 支持自定义下载路径
- 📊 实时下载进度显示
- 📝 下载历史记录
- 🔧 自动检测 gamdl 安装状态
- 🍪 支持 cookies 文件认证
- 💻 跨平台支持（Windows/macOS/Linux）

## 🚀 快速开始

### 前置要求

1. **Node.js** (版本 16 或更高)
2. **gamdl** 库

### 安装 gamdl

在运行应用之前，您需要先安装 gamdl 库：

```bash
# 使用 pip 安装 gamdl
pip install gamdl

# 或者使用 pipx（推荐）
pipx install gamdl
```

### 安装和运行

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd Apple-Music-Downloader
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动应用**
   ```bash
   npm start
   ```

4. **开发模式**
   ```bash
   npm run dev
   ```

## 📦 构建和打包

### 构建所有平台
```bash
npm run build
```

### 构建特定平台
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

构建完成后，可执行文件将位于 `dist/` 目录中。

## 🎯 使用方法

1. **启动应用** - 运行 `npm start`
2. **检查状态** - 确保 gamdl 状态显示为"已安装"
3. **输入链接** - 粘贴 Apple Music 歌曲或专辑链接
4. **选择音质** - 根据需要选择音质等级
5. **选择路径** - 点击"选择文件夹"按钮选择下载目录
6. **开始下载** - 点击"开始下载"按钮

## 🛠️ 技术栈

- **Electron** - 跨平台桌面应用框架
- **gamdl** - Apple Music 下载库
- **HTML/CSS/JavaScript** - 前端界面
- **Node.js** - 后端逻辑

## 📁 项目结构

```
Apple-Music-Downloader/
├── src/
│   ├── main.js              # Electron 主进程
│   └── renderer/
│       ├── index.html       # 主界面
│       ├── styles.css       # 样式文件
│       └── renderer.js      # 渲染进程逻辑
├── assets/                  # 资源文件
├── dist/                    # 构建输出
├── package.json
└── README.md
```

## ⚠️ 注意事项

- 本工具仅供学习和个人使用
- 请遵守相关法律法规和版权规定
- 下载的音乐文件仅供个人欣赏，不得用于商业用途
- 使用前请确保已获得相应的使用权限

## 🐛 故障排除

### gamdl 未安装
- 确保已正确安装 gamdl：`pip install gamdl`
- 检查 gamdl 是否在系统 PATH 中：`gamdl --version`

### 下载失败
- 检查网络连接
- 确认 Apple Music 链接格式正确
- 查看应用内的错误日志

### 构建失败
- 确保 Node.js 版本符合要求
- 清除 node_modules 并重新安装：`rm -rf node_modules && npm install`

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如果您遇到问题或有建议，请创建 Issue 或联系开发者。