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

// ================== 表单构建器 ==================
class FormBuilder {
    constructor() {
        this.fields = [];
    }

    // 添加文本/数字/日期等输入框
    addInput(id, label, type = 'text', placeholder = '', value = '') {
        this.fields.push({ id, label, type, placeholder, value });
        return this;
    }

    // 添加下拉选择框
    addSelect(id, label, options = [], selectedValue = '') {
        this.fields.push({ id, label, type: 'select', options, selectedValue });
        return this;
    }

    // 添加文本域
    addTextarea(id, label, placeholder = '', value = '') {
        this.fields.push({ id, label, type: 'textarea', placeholder, value });
        return this;
    }

    // 生成 HTML 字符串
    render() {
        return this.fields.map(f => {
            const labelHtml = f.label ? `<label>${escapeHtml(f.label)}</label>` : '';
            let inputHtml = '';
            if (f.type === 'select') {
                const optionsHtml = f.options.map(opt => 
                    `<option value="${escapeHtml(opt.value)}" ${opt.value == f.selectedValue ? 'selected' : ''}>${escapeHtml(opt.text)}</option>`
                ).join('');
                inputHtml = `<select id="${f.id}" class="form-control">${optionsHtml}</select>`;
            } else if (f.type === 'textarea') {
                inputHtml = `<textarea id="${f.id}" class="form-control" placeholder="${escapeHtml(f.placeholder)}">${escapeHtml(f.value)}</textarea>`;
            } else {
                inputHtml = `<input type="${f.type}" id="${f.id}" class="form-control" placeholder="${escapeHtml(f.placeholder)}" value="${escapeHtml(f.value)}">`;
            }
            return `<div class="form-group">${labelHtml}${inputHtml}</div>`;
        }).join('');
    }

    // 静态方法：从表单收集数据
    static collect(fieldIds) {
        const data = {};
        fieldIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) data[id] = el.value.trim();
        });
        return data;
    }

    // 静态方法：填充表单数据
    static fill(data) {
        Object.keys(data).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = data[id] || '';
        });
    }
}

// ================== 表格构建器 ==================
class TableBuilder {
    constructor() {
        this.columns = [];
        this.data = [];
        this.emptyText = '暂无数据';
    }

    // 添加列配置
    addColumn(key, label, renderFn = null) {
        this.columns.push({ key, label, render: renderFn });
        return this;
    }

    // 设置数据
    setData(data) {
        this.data = data || [];
        return this;
    }

    // 设置空数据提示
    setEmptyText(text) {
        this.emptyText = text;
        return this;
    }

    // 渲染表格 HTML
    render() {
        if (!this.data.length) {
            return `<table class="table"><tr><td colspan="${this.columns.length}">${this.emptyText}</td></tr></table>`;
        }
        const header = `
            <thead>
                <tr>${this.columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr>
            </thead>
        `;
        const body = `
            <tbody>
                ${this.data.map(row => `
                    <tr>
                        ${this.columns.map(c => {
                            let value = row[c.key];
                            if (c.render) {
                                return `<td>${c.render(value, row)}</td>`;
                            }
                            return `<td>${escapeHtml(value ?? '')}</td>`;
                        }).join('')}
                    </tr>
                `).join('')}
            </tbody>
        `;
        return `<table class="table">${header}${body}</table>`;
    }
}

// 挂载到全局
window.FormBuilder = FormBuilder;
window.TableBuilder = TableBuilder;