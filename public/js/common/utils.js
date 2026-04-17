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

/**
 * 为异步操作添加按钮锁，防止重复提交
 * @param {HTMLButtonElement} btn - 触发操作的按钮
 * @param {Function} asyncFn - 异步函数，返回 Promise
 * @param {Object} options - 可选配置
 * @returns {Promise} asyncFn 的返回值
 */
function withLock(btn, asyncFn, options = {}) {
    const { loadingText = '处理中...', successText = null, successDuration = 1500 } = options;
    if (btn.disabled) return Promise.reject(Modal.alert('操作进行中，请稍候'));

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = loadingText;

    // 清除之前可能残留的恢复定时器
    if (btn._restoreTimer) {
        clearTimeout(btn._restoreTimer);
        btn._restoreTimer = null;
    }

    return asyncFn()
        .then(result => {
            btn.disabled = false;
            if (successText) {
                btn.textContent = successText;
                if (successDuration > 0) {
                    btn._restoreTimer = setTimeout(() => {
                        btn.textContent = originalText;
                        btn._restoreTimer = null;
                    }, successDuration);
                }
            } else {
                btn.textContent = originalText;
            }
            return result;
        })
        .catch(err => {
            btn.disabled = false;
            btn.textContent = originalText;
            if (btn._restoreTimer) {
                clearTimeout(btn._restoreTimer);
                btn._restoreTimer = null;
            }
            throw err;
        });
}