package backend

import "fmt"

// FetchRemoteAuthorProfile 保留空方法签名以维持 Wails 绑定兼容性
func (a *App) FetchRemoteAuthorProfile(rawURL string, timeoutMs int) (map[string]interface{}, error) {
	return nil, fmt.Errorf("not available")
}
