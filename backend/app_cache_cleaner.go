package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ─── 类型定义 ────────────────────────────────────────────────────────

// ProfileCacheInfo 单个实例的缓存信息
type ProfileCacheInfo struct {
	ProfileID   string `json:"profileId"`
	ProfileName string `json:"profileName"`
	CacheSize   int64  `json:"cacheSize"`
	UserDataDir string `json:"userDataDir"`
}

// CacheInfo 总体缓存信息
type CacheInfo struct {
	TotalCacheSize int64              `json:"totalCacheSize"`
	Profiles       []ProfileCacheInfo `json:"profiles"`
	LastCleanAt    string             `json:"lastCleanAt"`
}

// CacheCleanResult 清理结果
type CacheCleanResult struct {
	FreedBytes  int64  `json:"freedBytes"`
	CleanedDirs int    `json:"cleanedDirs"`
	Message     string `json:"message"`
}

// AutoCacheCleanConfig 自动清理配置
type AutoCacheCleanConfig struct {
	Enabled      bool   `json:"enabled"`
	IntervalDays int    `json:"intervalDays"`
	LastCleanAt  string `json:"lastCleanAt"`
}

var (
	cacheCleanMu     sync.Mutex
	autoCleanCfgPath string
)

// ─── 缓存目录模式（要清理的目录列表）──────────────

// cacheDirPatterns 每个 profile userDataDir 下要清理的缓存子路径
// 只清理可安全重新生成的缓存数据，不动用户数据（Cookie、LocalStorage 等）
var cacheDirPatterns = []string{
	"Default/Cache",
	"Default/Code Cache",
	"Default/GPUCache",
	"Default/blob_storage",
	"Default/Service Worker/CacheStorage",
	// "Default/Storage",  // 已移除：包含 ext/*/def/ 下的扩展 IndexedDB 数据（MetaMask/Rabby 等钱包）
	"Dictionaries",
}

// initAutoCleanPath 在 startup 时注入保存路径
func initAutoCleanPath(appRoot string) {
	autoCleanCfgPath = filepath.Join(appRoot, "data", "auto_cache_clean.json")
}

// ─── 公开 Wails 绑定方法 ────────────────────────────────────────

// GetCacheInfo 扫描所有浏览器实例的缓存目录，返回各实例缓存大小
func (a *App) GetCacheInfo() (*CacheInfo, error) {
	profiles, err := a.browserMgr.List()
	if err != nil {
		return nil, fmt.Errorf("获取实例列表失败: %w", err)
	}

	cfg := a.loadAutoCleanConfig()
	info := &CacheInfo{
		LastCleanAt: cfg.LastCleanAt,
		Profiles:    make([]ProfileCacheInfo, 0),
	}

	for _, p := range profiles {
		p := p
		userDataDir := a.browserMgr.ResolveUserDataDir(&p)
		var size int64
		for _, pattern := range cacheDirPatterns {
			dir := filepath.Join(userDataDir, pattern)
			size += dirSize(dir)
		}

		if size > 0 {
			info.Profiles = append(info.Profiles, ProfileCacheInfo{
				ProfileID:   p.ProfileId,
				ProfileName: p.ProfileName,
				CacheSize:   size,
				UserDataDir: userDataDir,
			})
			info.TotalCacheSize += size
		}
	}

	// 按缓存大小降序排列
	sort.Slice(info.Profiles, func(i, j int) bool {
		return info.Profiles[i].CacheSize > info.Profiles[j].CacheSize
	})

	return info, nil
}

// CleanAllBrowserCache 清理所有浏览器实例的缓存目录
func (a *App) CleanAllBrowserCache() (*CacheCleanResult, error) {
	cacheCleanMu.Lock()
	defer cacheCleanMu.Unlock()

	profiles, err := a.browserMgr.List()
	if err != nil {
		return nil, fmt.Errorf("获取实例列表失败: %w", err)
	}

	totalFreed := int64(0)
	cleanedCount := 0
	var errors []string

	for _, p := range profiles {
		p := p
		// 跳过正在运行的实例
		if p.Running {
			continue
		}

		userDataDir := a.browserMgr.ResolveUserDataDir(&p)
		freed, err := cleanProfileCache(userDataDir)
		if err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", p.ProfileName, err))
			continue
		}
		if freed > 0 {
			totalFreed += freed
			cleanedCount++
		}
	}

	// 更新最后清理时间
	cfg := a.loadAutoCleanConfig()
	cfg.LastCleanAt = time.Now().Format(time.RFC3339)
	a.saveAutoCleanConfig(*cfg)

	msg := fmt.Sprintf("清理完成：释放 %s，涉及 %d 个实例", formatBytes(totalFreed), cleanedCount)
	if len(errors) > 0 {
		msg += fmt.Sprintf("（%d 个跳过/错误）", len(errors))
	}

	return &CacheCleanResult{
		FreedBytes:  totalFreed,
		CleanedDirs: cleanedCount,
		Message:     msg,
	}, nil
}

// GetAutoCacheCleanConfig 获取自动清理配置
func (a *App) GetAutoCacheCleanConfig() *AutoCacheCleanConfig {
	return a.loadAutoCleanConfig()
}

// SaveAutoCacheCleanConfig 保存自动清理配置
func (a *App) SaveAutoCacheCleanConfig(cfg AutoCacheCleanConfig) bool {
	a.saveAutoCleanConfig(cfg)
	return true
}

// ─── 内部实现 ──────────────────────────────────────────────────────────

// cleanProfileCache 清理单个实例的缓存目录，返回释放的字节数
func cleanProfileCache(userDataDir string) (int64, error) {
	var totalFreed int64
	for _, pattern := range cacheDirPatterns {
		target := filepath.Join(userDataDir, pattern)
		if !pathExists(target) {
			continue
		}

		// 先计算大小
		size := dirSize(target)
		if size <= 0 {
			continue
		}

		// 删除目录
		if err := os.RemoveAll(target); err != nil {
			return totalFreed, fmt.Errorf("清理 %s 失败: %w", pattern, err)
		}
		totalFreed += size
	}
	return totalFreed, nil
}

// dirSize 递归计算目录总大小（字节）
func dirSize(path string) int64 {
	var size int64
	_ = filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // 跳过无法访问的路径
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size
}

// pathExists 判断路径是否存在
func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// formatBytes 将字节数格式化为人类可读字符串
func formatBytes(b int64) string {
	switch {
	case b < 1024:
		return fmt.Sprintf("%d B", b)
	case b < 1024*1024:
		return fmt.Sprintf("%.1f KB", float64(b)/1024)
	case b < 1024*1024*1024:
		return fmt.Sprintf("%.1f MB", float64(b)/(1024*1024))
	default:
		return fmt.Sprintf("%.2f GB", float64(b)/(1024*1024*1024))
	}
}

// loadAutoCleanConfig 从 JSON 文件加载自动清理配置
func (a *App) loadAutoCleanConfig() *AutoCacheCleanConfig {
	cfg := &AutoCacheCleanConfig{
		Enabled:      false,
		IntervalDays: 7,
	}

	data, err := os.ReadFile(autoCleanCfgPath)
	if err != nil {
		return cfg
	}

	// 简单 JSON 解析，不引入额外依赖
	_ = parseSimpleJSON(string(data), cfg)
	return cfg
}

// saveAutoCleanConfig 保存自动清理配置到 JSON 文件
func (a *App) saveAutoCleanConfig(cfg AutoCacheCleanConfig) {
	dir := filepath.Dir(autoCleanCfgPath)
	_ = os.MkdirAll(dir, 0755)

	jsonStr := fmt.Sprintf(`{
  "enabled": %t,
  "intervalDays": %d,
  "lastCleanAt": "%s"
}`, cfg.Enabled, cfg.IntervalDays, cfg.LastCleanAt)

	_ = os.WriteFile(autoCleanCfgPath, []byte(jsonStr), 0644)
}

// parseSimpleJSON 简单 JSON 解析器，用于读取 auto_cache_clean.json
func parseSimpleJSON(data string, cfg *AutoCacheCleanConfig) error {
	lines := strings.Split(data, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "\"enabled\":") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				val := strings.TrimRight(strings.TrimSpace(parts[1]), ",")
				cfg.Enabled = val == "true"
			}
		} else if strings.HasPrefix(line, "\"intervalDays\":") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				val := strings.TrimRight(strings.TrimSpace(parts[1]), ",")
				fmt.Sscanf(val, "%d", &cfg.IntervalDays)
			}
		} else if strings.HasPrefix(line, "\"lastCleanAt\":") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				val := strings.TrimSpace(parts[1])
				val = strings.Trim(val, "\" ,")
				cfg.LastCleanAt = val
			}
		}
	}
	return nil
}
