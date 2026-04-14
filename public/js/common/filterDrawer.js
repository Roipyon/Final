//创建筛选抽屉 DOM 元素（仅执行一次）
function createFilterDrawer() {
    // 避免重复创建
    if (document.getElementById('mobileFilterDrawer')) return;

    // 遮罩层
    const backdrop = document.createElement('div');
    backdrop.className = 'filter-drawer-backdrop';
    backdrop.id = 'filterDrawerBackdrop';

    // 抽屉主体
    const drawer = document.createElement('div');
    drawer.className = 'filter-drawer';
    drawer.id = 'mobileFilterDrawer';
    drawer.innerHTML = `
        <div class="filter-drawer-header">
            <span>筛选条件</span>
            <button class="filter-drawer-close">&times;</button>
        </div>
        <div class="filter-drawer-body" id="mobileFilterBody"></div>
        <div class="filter-drawer-footer">
            <button class="btn-default" id="mobileFilterReset">重置</button>
            <button class="btn-primary" id="mobileFilterApply">应用</button>
        </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    // 关闭抽屉的事件
    const closeDrawer = () => {
        drawer.classList.remove('show');
        backdrop.classList.remove('show');
        document.body.style.overflow = '';
    };

    backdrop.addEventListener('click', closeDrawer);
    drawer.querySelector('.filter-drawer-close').addEventListener('click', closeDrawer);
}

/**
 * 打开筛选抽屉
 * @param {string} filterBarHTML - 当前筛选栏的 innerHTML
 * @param {Object} callbacks - 回调函数集合
 * @param {Function} callbacks.onApply - 应用筛选时的回调，接收 drawerBody 元素
 * @param {Function} callbacks.onReset - 重置筛选时的回调
 */
function openFilterDrawer(filterBarHTML, callbacks) {
    createFilterDrawer();

    const drawer = document.getElementById('mobileFilterDrawer');
    const backdrop = document.getElementById('filterDrawerBackdrop');
    const body = document.getElementById('mobileFilterBody');

    // 填充筛选内容
    body.innerHTML = filterBarHTML;

    // 绑定按钮事件（移除旧监听器）
    const applyBtn = document.getElementById('mobileFilterApply');
    const resetBtn = document.getElementById('mobileFilterReset');

    const newApply = applyBtn.cloneNode(true);
    const newReset = resetBtn.cloneNode(true);
    applyBtn.parentNode.replaceChild(newApply, applyBtn);
    resetBtn.parentNode.replaceChild(newReset, resetBtn);

    newApply.addEventListener('click', () => {
        if (callbacks.onApply) {
            callbacks.onApply(body);
        }
        drawer.classList.remove('show');
        backdrop.classList.remove('show');
        document.body.style.overflow = '';
    });

    newReset.addEventListener('click', () => {
        if (callbacks.onReset) {
            callbacks.onReset();
        }
        drawer.classList.remove('show');
        backdrop.classList.remove('show');
        document.body.style.overflow = '';
    });

    // 显示抽屉
    drawer.classList.add('show');
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
}

//关闭筛选抽屉
function closeFilterDrawer() {
    const drawer = document.getElementById('mobileFilterDrawer');
    const backdrop = document.getElementById('filterDrawerBackdrop');
    if (drawer) drawer.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
    document.body.style.overflow = '';
}

export { openFilterDrawer, closeFilterDrawer, createFilterDrawer };