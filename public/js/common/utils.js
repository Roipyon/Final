// 通用工具函数
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

/**
 * 生成分页 HTML
 * @param {number} currentPage - 当前页码（从1开始）
 * @param {number} totalPages - 总页数
 * @returns {string} 分页 HTML 字符串
 */
function renderSmartPagination(currentPage, totalPages) {
    if (totalPages <= 1) return '';

    const maxVisible = 5;  // 最多显示5个页码按钮
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    // 调整起始页，确保显示足够数量
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    let html = '<div class="pagination">';

    // 上一页
    if (currentPage > 1) {
        html += `<button class="page-btn" data-page="${currentPage - 1}">上一页</button>`;
    }

    // 首页省略
    if (startPage > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            html += '<span class="page-ellipsis">...</span>';
        }
    }

    // 中间页码
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active-page' : ''}" data-page="${i}">${i}</button>`;
    }

    // 尾页省略
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += '<span class="page-ellipsis">...</span>';
        }
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // 下一页
    if (currentPage < totalPages) {
        html += `<button class="page-btn" data-page="${currentPage + 1}">下一页</button>`;
    }

    html += '</div>';
    return html;
}