# Browser Manager

> A cross-platform desktop tool for managing multiple isolated browser instances, proxy binding, and local environment management.

---

**English** · [中文](#浏览器管理器)

---

## Overview

Browser Manager is a powerful desktop application that allows you to create, manage, and run multiple isolated browser environments on a single machine. Each instance can have its own proxy configuration, browser fingerprint, and local storage — making it ideal for multi-account operations, social media management, e-commerce store operations, and isolated testing environments.

## Key Features

- **🧩 Instance Management** — Create, edit, clone, start, stop, and delete isolated browser instances with independent profiles
- **🔌 Proxy Management** — Configure HTTP, HTTPS, SOCKS5 proxies per instance; support importing Clash subscription links and VMess/VLESS/Trojan/Shadowsocks protocols
- **⚙️ Kernel Management** — Manage multiple Chrome kernel (fingerprint-chromium) versions simultaneously
- **⚡ Quick Actions** — Launch instances instantly via custom short codes or `Ctrl + K` quick search
- **🏷️ Tag & Filter** — Organize instances with tags, filter by keyword, and sort by status
- **💾 Local-First** — All configuration and data stored locally; no cloud dependency, full privacy control
- **🔄 Cloning** — Duplicate existing instances with all settings preserved

## Recommended Kernel

This project recommends [**fingerprint-chromium**](https://github.com/adryfish/fingerprint-chromium) as the browser kernel for optimal fingerprinting and isolation support.

## System Requirements

| Requirement | Windows | Linux |
|-------------|---------|-------|
| **OS** | Windows 10/11 (64-bit) | amd64 / arm64 |
| **RAM** | 8 GB+ recommended | 8 GB+ recommended |
| **Disk** | 2 GB+ free space | 2 GB+ free space |
| **Binaries** | — | `xray` + `sing-box` in `bin/` |

## Quick Start

### Download

Download the latest release from the [Releases](https://github.com/galaylm/bm-desktop-tool/releases) page.

### Development

```bash
# Windows
cd bat && dev.bat

# Linux
# Refer to publish/linux/ for build scripts
```

> **Note:** The project uses `master` as its main branch.

## Common Operations

| Action | Description |
|--------|-------------|
| Create instance | Define name, proxy, kernel version, and tags |
| Start instance | Launches an isolated Chrome window |
| Clone instance | Duplicate an existing instance with the same configuration |
| Assign proxy | Bind or change proxy settings per instance |
| Quick search | Press `Ctrl + K` to search and launch instances |

## Roadmap

- [ ] Automation & scripting support
- [ ] Batch instance operations
- [ ] Export / Import instance configurations
- [ ] Team collaboration features

## Recent Updates

**v1.7.3** (2026-06-22)
- Fixed instance persistence issues after importing extensions
- Improved cleanup of unused extension directories

---

# 浏览器管理器

> 面向多账号隔离、代理绑定和本地环境管理的跨平台桌面浏览器管理工具

## 概述

浏览器管理器是一款功能强大的桌面应用，让您可以在单台机器上创建和管理多个相互隔离的浏览器环境。每个实例可拥有独立的代理配置、浏览器指纹和本地存储空间，非常适合多账号运营、社交媒体管理、电商店铺运营以及隔离测试环境等场景。

## 核心功能

- **🧩 实例管理** — 创建、编辑、克隆、启动、停止和删除隔离浏览器实例，每个实例拥有独立配置文件
- **🔌 代理支持** — 为每个实例配置 HTTP、HTTPS、SOCKS5 代理；支持导入 Clash 订阅链接及 VMess/VLESS/Trojan/Shadowsocks 协议
- **⚙️ 内核管理** — 同时管理多个 Chrome 内核（fingerprint-chromium）版本
- **⚡ 快捷操作** — 通过自定义短码或 `Ctrl + K` 快速搜索启动实例
- **🏷️ 标签筛选** — 使用标签组织实例，按关键词筛选和按状态排序
- **💾 本地优先** — 所有配置和数据存储在本地，无云端依赖，完全掌控隐私
- **🔄 克隆复制** — 一键复制现有实例，保留所有设置

## 推荐内核

本项目推荐使用 [**fingerprint-chromium**](https://github.com/adryfish/fingerprint-chromium) 作为浏览器内核，以获得最佳的指纹识别和环境隔离支持。

## 系统要求

| 要求 | Windows | Linux |
|------|---------|-------|
| **操作系统** | Windows 10/11（64位） | amd64 / arm64 |
| **内存** | 建议 8 GB 以上 | 建议 8 GB 以上 |
| **磁盘** | 需 2 GB 以上可用空间 | 需 2 GB 以上可用空间 |
| **依赖组件** | — | `xray` + `sing-box`（置于 `bin/` 目录） |

## 快速开始

### 下载

从 [Releases](https://github.com/galaylm/bm-desktop-tool/releases) 页面下载最新版本。

### 开发

```bash
# Windows
cd bat && dev.bat

# Linux
参考 publish/linux/ 下的构建脚本
```

> **注意：** 项目使用 `master` 作为主分支。

## 常用操作

| 操作 | 说明 |
|------|------|
| 创建实例 | 定义名称、代理、内核版本和标签 |
| 启动实例 | 打开一个隔离的 Chrome 窗口 |
| 克隆实例 | 复制现有实例及全部配置 |
| 绑定代理 | 为每个实例设置或更改代理 |
| 快速搜索 | 按 `Ctrl + K` 搜索并启动实例 |

## 开发路线

- [ ] 自动化与脚本支持
- [ ] 批量实例操作
- [ ] 导入/导出实例配置
- [ ] 团队协作功能

## 最近更新

**v1.7.3**（2026-06-22）
- 修复导入扩展后实例持久化问题
- 改进未使用扩展目录的清理机制

---

*Built with ❤️ for efficiency and privacy.*
