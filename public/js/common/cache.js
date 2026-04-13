// ================== 本地缓存工具 ==================
const Cache = {
    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {any} value - 缓存值（会被 JSON.stringify）
     * @param {number} ttl - 过期时间（秒），默认 3600 秒（1小时）
     */
    set(key, value, ttl = 3600) {
        const expires = Date.now() + ttl * 1000;
        const data = { value, expires };
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('缓存写入失败:', e);
        }
    },

    /**
     * 获取缓存
     * @param {string} key
     * @returns {any|null} 缓存值，若已过期或不存在则返回 null
     */
    get(key, ignoreExpires = false) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!ignoreExpires && Date.now() > data.expires) {
                localStorage.removeItem(key);
                return null;
            }
            return data.value;
        } catch (e) {
            return null;
        }
    },

    /**
     * 删除缓存
     */
    remove(key) {
        localStorage.removeItem(key);
    },

    /**
     * 清空所有以某前缀开头的缓存
     */
    clearByPrefix(prefix) {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(prefix)) localStorage.removeItem(key);
        });
    }
};

window.Cache = Cache;