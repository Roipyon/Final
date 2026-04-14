// 通知卡片组件
// 使用示例：
// const card = new NoticeCard(noticeData, { expandable: true, showActions: false });
// card.mount(container);

export class NoticeCard {
    /**
     * 创建一个通知卡片实例
     * @param {Object} notice - 通知数据对象
     * @param {number} notice.id - 通知唯一标识
     * @param {string} notice.title - 通知标题
     * @param {string} notice.content - 通知正文内容
     * @param {string} notice.className - 所属班级名称
     * @param {string} notice.publishTime - 发布时间（ISO 字符串）
     * @param {string} notice.teacher_name - 发布人姓名
     * @param {number} [notice.readCount] - 已读人数（教师端用）
     * @param {number} [notice.totalStudents] - 班级总人数（教师端用）
     * @param {number} [notice.totalStu] - 班级总人数（兼容字段）
     */
    constructor(notice, options = {}) {
        this.notice = notice;
        this.options = {
            expandable: true,
            showBadge: true,
            showActions: false,
            showReadStats: true,
            badgeMode: null,
            badgeText: undefined,
            onEdit: null,
            onDelete: null,
            onExpand: null,
            onViewRead: null,
            ...options
        };
        this.element = this._render();
        this._bindEvents();
    }

    // 生成 DOM 元素
    _render() {
        // 教师端：未读判断依据是 readCount < totalStudents（有未读学生）
        const total = this.notice.totalStudents || this.notice.totalStu || 0;
        const read = this.notice.readCount || 0;

        // 根据模式计算 isUnread / isNew 及徽章文本
        let isUnread = false;
        let isNew = false;
        let badgeText = '';

        switch (this.options.badgeMode) {
            case 'admin':
                // 教务端：只看是否新通知（24h内）
                isNew = this._isNewNotice(this.notice.publishTime);
                badgeText = isNew ? '新' : '';
                isUnread = false;   // 教务端不使用未读样式
                break;

            case 'teacher':
                // 教师端：只看是否有未读学生（已读人数 < 总人数）
                isUnread = (total > 0 && read < total);
                badgeText = isUnread ? '未读' : '';
                isNew = false;      // 教师端不显示“新”
                break;

            case 'student':
            default:
                // 学生端：优先判断未读，若无未读则判断是否新通知
                isUnread = this.options.isUnread !== undefined 
                    ? this.options.isUnread 
                    : !this.notice.isRead;   // 假设 notice.isRead 字段存在
                badgeText = isUnread ? '未读' : '';
                break;
        }

        // 允许通过 options 直接覆盖徽章文本（优先级最高）
        if (this.options.badgeText !== undefined) {
            badgeText = this.options.badgeText;
        }

        const showBadge = this.options.showBadge && Boolean(badgeText);

        const container = document.createElement('div');
        container.className = `notice-item ${isUnread || isNew ? 'unread' : ''}`;
        container.dataset.id = this.notice.id;

        container.innerHTML = `
            <div class="notice-summary">
                <span class="title">
                    ${escapeHtml(this.notice.title)}
                    ${showBadge ? `<span class="notice-badge-sm" style="background: #e6a23c;">${escapeHtml(badgeText)}</span>` : ''}
                </span>
                <span class="meta">${escapeHtml(this.notice.className)} · ${this._formatDate(this.notice.publishTime)}</span>
                ${this.options.expandable ? '<span class="expand-icon">▼</span>' : ''}
            </div>
            <div class="notice-detail">
                <div class="notice-content">${escapeHtml(this.notice.content)}</div>
                <div class="notice-time">
                    发布人：${escapeHtml(this.notice.teacher_name)}
                    ${this.options.showReadStats ? ` | 已读 ${read}/${total || 0}` : ''}
                </div>
                ${this.options.showActions ? this._renderActions() : ''}
            </div>
        `;
        return container;
    }

    // 操作按钮（编辑/删除）
    _renderActions() {
        return `
            <div class="notice-actions" style="margin-top:12px; display:flex; gap:8px;">
                <button class="btn-sm edit-btn" data-action="edit">编辑</button>
                <button class="btn-sm btn-danger delete-btn" data-action="delete">删除</button>
                <button class="btn-sm view-read-btn" data-action="viewRead">查看已读名单</button>
            </div>
        `;
    }

    // 绑定内部事件
    _bindEvents() {
        const summary = this.element.querySelector('.notice-summary');
        if (summary && this.options.expandable) {
            summary.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡到全局，防止二次切换
                // 如果点击的是按钮，不触发展开
                if (e.target.tagName === 'BUTTON') return;
                this.toggle();
                if (this.options.onExpand) {
                    this.options.onExpand(this.notice.id);
                }
            });
        }

        // 操作按钮事件
        if (this.options.showActions) {
            this.element.querySelector('.edit-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.options.onEdit?.(this.notice);
            });
            this.element.querySelector('.delete-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.options.onDelete?.(this.notice);
            });
            this.element.querySelector('.view-read-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.options.onViewRead?.(this.notice);
            });
        }
    }

    // 公共方法：切换展开/收起
    toggle() {
        this.element.classList.toggle('expanded');
    }

    // 公共方法：标记已读
    markAsRead() {
        this.element.classList.add('read');
        this.element.classList.remove('unread');
        const badge = this.element.querySelector('.notice-badge-sm');
        if (badge) badge.remove();
    }

    // 公共方法：挂载到容器
    mount(container) {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        container.appendChild(this.element);
    }

    // 公共方法：移除
    remove() {
        this.element.remove();
    }

    // 辅助：判断是否24小时内发布
    _isNewNotice(publishTime) {
        const diff = (new Date() - new Date(publishTime)) / (1000 * 60 * 60);
        return diff <= 24;
    }

    // 辅助：格式化日期
    _formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('zh-CN');
    }
}