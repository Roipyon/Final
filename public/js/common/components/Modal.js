// ================== 通用弹窗组件 ==================
// 基于类封装，支持 alert、confirm、自定义内容

export class Modal {
    // 静态方法：快速弹窗（不需要 new）
    static alert(message, title = '提示') {
        return new Modal().alert(message, title);
    }

    static confirm(message, title = '确认') {
        return new Modal().confirm(message, title);
    }

    static custom(options) {
        return new Modal().custom(options);
    }

    constructor() {
        this.modal = null;           // 弹窗容器元素
        this.resolvePromise = null;  // confirm 的 Promise resolve
    }

    // 创建基础 DOM 结构
    _createContainer() {
        const modal = document.createElement('div');
        modal.className = 'modal-mask';
        modal.style.display = 'none';
        
        const container = document.createElement('div');
        container.className = 'modal-container';
        modal.appendChild(container);
        
        // 点击遮罩关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });
        
        document.body.appendChild(modal);
        return { modal, container };
    }

    // 显示弹窗
    _show(modal) {
        modal.style.display = 'flex';
        // 防止背景滚动
        document.body.style.overflow = 'hidden';
    }

    // 关闭弹窗
    close() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = '';
            // 可选：移除 DOM，但保留可以复用
            // this.modal.remove();
            // this.modal = null;
        }
    }

    // 销毁弹窗（完全移除）
    destroy() {
        if (this.modal) {
            this.modal.remove();
            document.body.style.overflow = '';
            this.modal = null;
        }
    }

    // ========== Alert 弹窗 ==========
    alert(message, title = '提示') {
        const { modal, container } = this._createContainer();
        this.modal = modal;

        container.innerHTML = `
            <h4 style="margin-bottom: 16px;">${escapeHtml(title)}</h4>
            <div style="margin-bottom: 20px; color: var(--gray-dark);">${escapeHtml(message)}</div>
            <div class="flex-btns">
                <button class="btn-primary btn-sm modal-close-btn">确定</button>
            </div>
        `;

        container.querySelector('.modal-close-btn').addEventListener('click', () => this.close());
        
        this._show(modal);
        return this;
    }

    // ========== Confirm 弹窗（返回 Promise）==========
    confirm(message, title = '确认') {
        const { modal, container } = this._createContainer();
        this.modal = modal;

        container.innerHTML = `
            <h4 style="margin-bottom: 16px;">${escapeHtml(title)}</h4>
            <div style="margin-bottom: 20px; color: var(--gray-dark);">${escapeHtml(message)}</div>
            <div class="flex-btns">
                <button class="btn-sm modal-cancel-btn">取消</button>
                <button class="btn-primary btn-sm modal-confirm-btn">确定</button>
            </div>
        `;

        this._show(modal);

        return new Promise((resolve) => {
            container.querySelector('.modal-confirm-btn').addEventListener('click', () => {
                this.close();
                resolve(true);
            });
            container.querySelector('.modal-cancel-btn').addEventListener('click', () => {
                this.close();
                resolve(false);
            });
            // 点击遮罩关闭视为取消
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                    resolve(false);
                }
            }, { once: true });
        });
    }

    // ========== 自定义弹窗 ==========
    // options: { title, content, buttons, onClose }
    custom(options) {
        const { modal, container } = this._createContainer();
        this.modal = modal;

        const title = options.title || '';
        const content = options.content || '';
        const buttons = options.buttons || [
            { text: '确定', type: 'primary', onClick: () => this.close() }
        ];

        let titleHtml = title ? `<h4 style="margin-bottom: 16px;">${escapeHtml(title)}</h4>` : '';
        
        let buttonsHtml = '';
        buttons.forEach(btn => {
            const btnClass = btn.type === 'primary' ? 'btn-primary' : (btn.type === 'danger' ? 'btn-danger' : '');
            buttonsHtml += `<button class="btn-sm ${btnClass} custom-modal-btn" data-action="${btn.action || ''}">${escapeHtml(btn.text)}</button>`;
        });

        container.innerHTML = `
            ${titleHtml}
            <div style="margin-bottom: 20px;">${content}</div>
            <div class="flex-btns">
                ${buttonsHtml}
            </div>
        `;

        // 绑定按钮事件
        container.querySelectorAll('.custom-modal-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const btnConfig = buttons[index];
                if (btnConfig.onClick) {
                    btnConfig.onClick(this);
                } else {
                    this.close();
                }
            });
        });

        this._show(modal);
        return this;
    }
}
