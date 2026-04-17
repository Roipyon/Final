// 班级管理
let currentSheet = null;

/**
 * 打开底部操作菜单
 * @param {Object} options - 配置项
 * @param {string} options.title - 标题（如班级名称）
 * @param {Array} options.actions - 操作项数组 [{ text: '绑定教师', onClick: Function }]
 * @param {string} options.extraHTML - 额外 HTML（如下拉框）
 */
function openActionSheet(options) {
    // 关闭已存在的抽屉
    closeActionSheet();

    const { title = '', actions = [], extraHTML = '' } = options;

    // 创建遮罩
    const backdrop = document.createElement('div');
    backdrop.className = 'action-sheet-backdrop';
    backdrop.addEventListener('click', closeActionSheet);

    // 创建抽屉主体
    const sheet = document.createElement('div');
    sheet.className = 'action-sheet';

    // 构建内容
    let actionsHtml = '';
    actions.forEach(action => {
        actionsHtml += `<button class="action-sheet-btn">${escapeHtml(action.text)}</button>`;
    });

    sheet.innerHTML = `
        <div class="action-sheet-header">
            <span>${escapeHtml(title)}</span>
            <button class="action-sheet-close">&times;</button>
        </div>
        <div class="action-sheet-body">
            ${extraHTML}
        </div>
        <div class="action-sheet-footer">
            ${actionsHtml}
            <button class="action-sheet-cancel">取消</button>
        </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    document.body.style.overflow = 'hidden';

    // 绑定关闭事件
    sheet.querySelector('.action-sheet-close').addEventListener('click', closeActionSheet);
    sheet.querySelector('.action-sheet-cancel').addEventListener('click', closeActionSheet);

    // 绑定操作按钮事件
    actions.forEach((action, index) => {
        const btn = sheet.querySelectorAll('.action-sheet-btn')[index];
        btn.addEventListener('click', () => {
            action.onClick();
            closeActionSheet();
        });
    });

    // 触发动画
    requestAnimationFrame(() => {
        backdrop.classList.add('show');
        sheet.classList.add('show');
    });

    currentSheet = { backdrop, sheet };
}

function closeActionSheet() {
    if (!currentSheet) return;
    const { backdrop, sheet } = currentSheet;
    backdrop.classList.remove('show');
    sheet.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => {
        backdrop.remove();
        sheet.remove();
    }, 200);
    currentSheet = null;
}

export { openActionSheet, closeActionSheet };