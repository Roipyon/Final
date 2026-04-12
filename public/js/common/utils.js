// ================== 通用工具函数 ==================
// 所有页面共享，包含防XSS、日期格式化、统计计算等

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString().replaceAll('/','-');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString();
}

function computeStats(scoresArray) {
    if (!scoresArray || scoresArray.length === 0) {
        return { avg: '0.0', max: 0, min: 0, passCount: 0, total: 0, passRate: '0%' };
    }
    const arr = scoresArray.map(s => parseFloat(s.score) || 0);
    const sum = arr.reduce((a, b) => a + b, 0);
    const avg = (sum / arr.length).toFixed(1);
    const max = Math.max(...arr);
    const min = Math.min(...arr);
    const passCount = arr.filter(s => s >= 60).length;
    const total = arr.length;
    const passRate = ((passCount / total) * 100).toFixed(1) + '%';
    return { avg, max, min, passCount, total, passRate };
}

// 防抖函数
function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// 判断通知是否为新（24小时内）
function isNewNotice(publishTime) {
    const diffHours = (new Date() - new Date(publishTime)) / (1000 * 60 * 60);
    return diffHours <= 24;
}