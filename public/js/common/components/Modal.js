// ================== 通用模态框组件 ==================
export class Modal {
    constructor(options = {}) {
        this.options = {
            title: '提示',
            content: '',
            confirmText: '确定',
            cancelText: '取消',
            showCancel: true,
            onConfirm: null,
            onCancel: null,
            onClose: null,
            ...options
        };
        this.element = this._render();
        this._bindEvents();
    }

    _render() {
        const mask = document.createElement('div');
        mask.className = 'modal-mask';
        mask.innerHTML = `
            <div class="modal-container">
                <h4 style="margin-bottom:16px;">${escapeHtml(this.options.title)}</h4>
                <div class="modal-body"></div>
                <div class="flex-btns">
                    ${this.options.showCancel ? `<button class="btn-cancel">${escapeHtml(this.options.cancelText)}</button>` : ''}
                    <button class="btn-primary btn-confirm">${escapeHtml(this.options.confirmText)}</button>
                </div>
            </div>
        `;
        
        const body = mask.querySelector('.modal-body');
        if (typeof this.options.content === 'string') {
            body.innerHTML = this.options.content;
        } else if (this.options.content instanceof HTMLElement) {
            body.appendChild(this.options.content);
        }
        
        return mask;
    }

    _bindEvents() {
        // 点击遮罩关闭
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) this.hide();
        });

        // 取消按钮
        this.element.querySelector('.btn-cancel')?.addEventListener('click', () => {
            this.options.onCancel?.();
            this.hide();
        });

        // 确认按钮
        this.element.querySelector('.btn-confirm')?.addEventListener('click', async () => {
            if (this.options.onConfirm) {
                await this.options.onConfirm(this._getFormData());
            }
            this.hide();
        });
    }

    _getFormData() {
        const form = this.element.querySelector('form');
        if (!form) return null;
        return Object.fromEntries(new FormData(form));
    }

    show() {
        document.body.appendChild(this.element);
    }

    hide() {
        this.element.remove();
        this.options.onClose?.();
    }

    // 设置加载状态（防止重复提交）
    setLoading(loading) {
        const btn = this.element.querySelector('.btn-confirm');
        btn.disabled = loading;
        btn.textContent = loading ? '提交中...' : this.options.confirmText;
    }
}