# LogCat Pro

LogCat Pro 是一款基于 Electron、Vue 3 和 TypeScript 开发的高性能 Android 日志分析工具。它旨在为开发者提供比原生 `adb logcat` 更高效、更直观、更智能的日志处理体验。

## 🚀 核心特性

- **实时采集**: 通过 ADB 协议实时捕获 Android 设备日志。
- **智能分析 (AI-Powered)**: 集成 Google Gemini 等大语言模型，自动分析 ANR、Crash 和性能瓶颈。
- **高性能渲染**: 使用虚拟列表（`@tanstack/vue-virtual`）技术，轻松应对百万级大数据量日志。
- **规则引擎**: 内置 ANR、Crash、Performance 等多种预设分析规则。
- **可视化统计**: 集成 ECharts，支持日志分布、系统资源占用等数据的图表展示。
- **持久化存储**: 使用 SQLite 数据库存储历史日志和书签。
- **导出功能**: 支持将分析结果导出为 PDF 报告。
- **自定义主题**: 内置现代化 UI 界面，支持高亮设置和自定义过滤。

## 🛠️ 技术栈

- **前端**: Vue 3, Pinia, Element Plus, ECharts, Vite
- **后端**: Electron, Node.js
- **数据库**: Better-sqlite3, sql.js
- **构建工具**: electron-vite, electron-builder
- **日志处理**: 自研 LogParser 与规则分析系统

## 📂 项目结构

```text
logcat-pro/
├── resources/           # 静态资源，包含内置的 ADB 二进制文件
└── src/
    ├── main/           # Electron 主进程
    │   ├── adb/        # ADB 连接与管理逻辑
    │   ├── ai/         # AI 服务（Gemini/LLM）与 PDF 生成
    │   ├── analyzer/   # 日志分析引擎及预设规则 (ANR/Crash/Perf)
    │   ├── collector/  # 日志采集与解析逻辑
    │   └── storage/    # 数据库持久化管理
    ├── preload/        # 预加载脚本（IPC 通信桥梁）
    ├── renderer/       # Vue 渲染进程
    │   ├── components/ # 业务组件（设备面板、过滤器、时间轴等）
    │   ├── stores/     # Pinia 状态管理
    │   ├── views/      # 页面视图（日志视图、分析视图、截图视图等）
    │   └── styles/     # 全局样式与变量
    └── shared/         # 主进程与渲染进程共享的类型定义
```

## 📦 快速开始

### 前提条件

- 已安装 [Node.js](https://nodejs.org/) (建议 v18+)
- 已安装 [npm](https://www.npmjs.com/) 或 [yarn](https://yarnpkg.com/)
- (可选) 已将手机开启开发者模式并连接至电脑

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

### 构建安装包

```bash
# 生成 Windows 安装包
npm run dist
```

## ⌨️ 常用命令

- `npm run dev`: 启动开发模式。
- `npm run build`: 编译主进程和渲染进程。
- `npm run pack`: 打包并生成可执行文件目录（不打包成安装包）。
- `npm run dist`: 执行完整构建并生成生产环境安装程序。

## 📄 许可证

[License Name] - 详情见 LICENSE 文件。

---
*LogCat Pro - 让 Android 日志分析更简单。*
