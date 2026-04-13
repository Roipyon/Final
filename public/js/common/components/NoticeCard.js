// ================== 通知卡片组件 ==================
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
     *
     * @param {Object} [options] - 组件配置项
     * @param {boolean} [options.expandable=true] - 是否可展开/收起详情
     * @param {boolean} [options.showBadge=true] - 是否显示未读/新徽章
     * @param {boolean} [options.showActions=false] - 是否显示操作按钮（编辑/删除/查看名单）
     * @param {boolean} [options.isUnread] - 强制指定未读状态（不传则自动根据已读人数判断）
     * @param {string} [options.badgeText] - 徽章显示文字（不传则根据上下文显示“未读”或“新”）
     * @param {Function} [options.onEdit] - 编辑按钮点击回调，参数为当前 notice 对象
     * @param {Function} [options.onDelete] - 删除按钮点击回调，参数为当前 notice 对象
     * @param {Function} [options.onExpand] - 卡片展开/收起时回调，参数为 notice.id
     * @param {Function} [options.onViewRead] - 查看已读名单按钮点击回调，参数为当前 notice 对象
     */
    constructor(notice, options = {}) {
        this.notice = notice;
        this.options = {
            expandable: true,
            showBadge: true,
            showActions: false,
            isUnread: undefined,
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
        // 教务端/学生端：可根据实际情况传入 isRead 字段，这里兼容多种情况
        const total = this.notice.totalStudents || this.notice.totalStu || 0;
        const read = this.notice.readCount || 0;
        
        // 是否未读：优先使用传入的 isUnread 标志，否则根据已读数判断
        const isUnread = this.options.isUnread !== undefined 
            ? this.options.isUnread 
            : (total > 0 && read < total);
        
        // 是否为新发布（24小时内）- 用于教务端
        const isNew = this._isNewNotice(this.notice.publishTime);
        const badgeText = this.options.badgeText || (this.options.isUnread ? '未读' : '新');
        
        const container = document.createElement('div');
        container.className = `notice-item ${isUnread ? 'unread' : ''}`;
        container.dataset.id = this.notice.id;

        container.innerHTML = `
            <div class="notice-summary">
                <span class="title">
                    ${escapeHtml(this.notice.title)}
                    ${this.options.showBadge && isUnread ? `<span class="notice-badge-sm" style="background: #e6a23c;">${badgeText}</span>` : ''}
                </span>
                <span class="meta">${escapeHtml(this.notice.className)} · ${this._formatDate(this.notice.publishTime)}</span>
                ${this.options.expandable ? '<span class="expand-icon">▼</span>' : ''}
            </div>
            <div class="notice-detail">
                <div class="notice-content">${escapeHtml(this.notice.content)}</div>
                <div class="notice-time">
                    发布人：${escapeHtml(this.notice.teacher_name)} | 已读 ${read}/${total || 0}
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