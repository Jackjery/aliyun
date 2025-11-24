/**
 * MultiSelectDropdown - 多选下拉框组件
 * 支持搜索、全选、标签显示
 */
class MultiSelectDropdown {
    constructor(dropdownId, optionsId, displayId, valueId, tagsId, searchId, selectAllId, onChange) {
        this.dropdownId = dropdownId;
        this.optionsId = optionsId;
        this.displayId = displayId;
        this.valueId = valueId;
        this.tagsId = tagsId;
        this.searchId = searchId;
        this.selectAllId = selectAllId;
        this.onChange = onChange;

        this.selectedValues = [];
        this.selectionOrder = []; // 记录选择的顺序，用于Backspace键删除
        this.allOptions = [];
        this.isAllSelected = false;

        // 绑定键盘事件处理函数到实例，以便后续添加/移除
        this.handleKeyDown = this.handleKeyDown.bind(this);

        this.init();
    }

    init() {
        const dropdownEl = document.getElementById(this.dropdownId);
        if (dropdownEl) {
            dropdownEl.addEventListener('click', (e) => {
                e.stopPropagation();

                // 点击标签删除按钮时，不切换下拉面板
                if (e.target.classList.contains('tag-remove')) {
                    return;
                }

                // 点击搜索框时，如果面板关闭则打开，如果已打开则保持打开
                const searchEl = document.getElementById(this.searchId);
                if (searchEl && searchEl.contains(e.target)) {
                    this.openDropdown();
                    return;
                }

                // 其他区域点击时切换下拉面板
                this.toggleDropdown();
            });
        }

        const searchEl = document.getElementById(this.searchId);
        if (searchEl) {
            searchEl.addEventListener('input', (e) => {
                this.filterOptions(e.target.value);
            });
        }

        const selectAllCheckbox = document.getElementById(this.selectAllId);
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelectAll();
            });
        }

        document.addEventListener('click', (e) => {
            const optionsContainer = document.getElementById(this.optionsId);
            const isClickInside = optionsContainer && (optionsContainer.contains(e.target) ||
                                  (dropdownEl && dropdownEl.contains(e.target)));

            if (!isClickInside) {
                this.closeDropdown();
            }
        });
    }

    /**
     * 处理键盘Backspace键事件
     */
    handleKeyDown(e) {
        // 按下Backspace键时删除最新添加的选项
        if (e.key === 'Backspace') {
            e.preventDefault();
            this.removeLatestSelection();
        }
    }

    setOptions(options) {
        this.allOptions = [...options];
        console.warn(`📝 [MultiSelect] setOptions 被调用，选项ID: ${this.optionsId}, 选项数量: ${options.length}`);
        this.renderOptions();
    }

    renderOptions(filter = '') {
        const optionsContainer = document.getElementById(this.optionsId);
        if (!optionsContainer) {
            console.error(`❌ [MultiSelect] 找不到选项容器: ${this.optionsId}`);
            return;
        }

        console.warn(`🎨 [MultiSelect] renderOptions 开始，选项ID: ${this.optionsId}, 全部选项数: ${this.allOptions.length}, 过滤器: "${filter}"`);

        // 查找或创建选项列表容器
        let listContainer = optionsContainer.querySelector('.dropdown-options-list');
        if (!listContainer) {
            // 旧结构兼容：直接清空并重建
            while (optionsContainer.children.length > 2) {
                optionsContainer.removeChild(optionsContainer.lastChild);
            }
            listContainer = optionsContainer;
        } else {
            // 新结构：仅清空列表容器
            listContainer.innerHTML = '';
        }

        const filteredOptions = this.allOptions.filter(option =>
            option.label.toLowerCase().includes(filter.toLowerCase())
        );

        console.warn(`🎨 [MultiSelect] 过滤后选项数: ${filteredOptions.length}`);

        filteredOptions.forEach(option => {
            const optionEl = document.createElement('div');
            optionEl.className = 'dropdown-option-item';
            if (this.selectedValues.includes(option.value)) {
                optionEl.classList.add('selected');
            }

            optionEl.innerHTML = `
                <input type="checkbox"
                       data-value="${option.value}"
                       ${this.selectedValues.includes(option.value) ? 'checked' : ''}>
                <span>${option.label}</span>
            `;

            const checkbox = optionEl.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleSelection(option.value, e.target.checked);
            });

            optionEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                    const ev = new Event('change', { bubbles: false });
                    checkbox.dispatchEvent(ev);
                }
            });

            listContainer.appendChild(optionEl);
        });

        this.updateSelectAllStatus();
    }

    filterOptions(keyword) {
        this.renderOptions(keyword);
    }

    toggleSelection(value, isChecked) {
        if (isChecked && !this.selectedValues.includes(value)) {
            this.selectedValues.push(value);
            // 记录选择顺序
            this.selectionOrder.push(value);
        } else if (!isChecked && this.selectedValues.includes(value)) {
            this.selectedValues = this.selectedValues.filter(v => v !== value);
            // 从选择顺序中移除
            this.selectionOrder = this.selectionOrder.filter(v => v !== value);
        }

        this.updateDisplay();
        this.updateTags();
        this.updateSelectAllStatus();

        // 【自动清除搜索框】选择后自动清空搜索内容，但保持下拉面板打开
        const searchEl = document.getElementById(this.searchId);
        if (searchEl) {
            searchEl.value = '';
            this.filterOptions(''); // 重置过滤，显示所有选项
        }

        if (this.onChange) {
            this.onChange([...this.selectedValues]);
        }

        // 保持下拉面板打开状态
        this.openDropdown();
    }

    toggleSelectAll() {
        const selectAllEl = document.getElementById(this.selectAllId);
        if (!selectAllEl) return;
        let checkbox = selectAllEl.querySelector('input[type="checkbox"]');

        if (!checkbox) {
            this.updateSelectAllStatus();
            checkbox = selectAllEl.querySelector('input[type="checkbox"]');
            if (!checkbox) return;
        }

        checkbox.checked = !checkbox.checked;
        const event = new Event('change', { bubbles: false });
        checkbox.dispatchEvent(event);
    }

    updateSelectAllStatus() {
        const optionsContainer = document.getElementById(this.optionsId);
        const selectAllEl = document.getElementById(this.selectAllId);
        if (!optionsContainer || !selectAllEl) return;

        const checkboxes = Array.from(optionsContainer.querySelectorAll('input[type="checkbox"]'))
            .filter(cb => !cb.closest('#' + this.selectAllId));

        const visibleOptionsCount = checkboxes.length;
        const selectedCount = checkboxes.filter(cb => cb.checked).length;

        let checkbox = selectAllEl.querySelector('input[type="checkbox"]');

        // 检查是否已经添加了事件监听器
        if (checkbox && !checkbox.dataset.listenerAdded) {
            // 为已存在的checkbox添加事件监听器
            checkbox.dataset.listenerAdded = 'true';
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const optionCheckboxes = Array.from(optionsContainer.querySelectorAll('input[type="checkbox"]'))
                    .filter(cb => !cb.closest('#' + this.selectAllId));

                if (e.target.checked) {
                    this.selectedValues = optionCheckboxes
                        .map(cb => cb.dataset.value)
                        .filter(Boolean);

                    // 全选时，记录所有新增的选项到选择顺序中
                    this.selectionOrder = [...this.selectedValues];

                    optionCheckboxes.forEach(cb => cb.checked = true);
                } else {
                    this.selectedValues = [];
                    this.selectionOrder = []; // 清空选择顺序
                    optionCheckboxes.forEach(cb => cb.checked = false);
                }

                this.updateDisplay();
                this.updateTags();

                if (this.onChange) this.onChange([...this.selectedValues]);
                this.openDropdown();
            });
        } else if (!checkbox) {
            // 如果checkbox不存在，创建新的
            selectAllEl.innerHTML = '';

            checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'mr-1';
            checkbox.id = `${this.selectAllId}-checkbox`;
            checkbox.dataset.listenerAdded = 'true';

            const label = document.createElement('span');
            label.textContent = '全选';

            selectAllEl.appendChild(checkbox);
            selectAllEl.appendChild(label);

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const optionCheckboxes = Array.from(optionsContainer.querySelectorAll('input[type="checkbox"]'))
                    .filter(cb => !cb.closest('#' + this.selectAllId));

                if (e.target.checked) {
                    this.selectedValues = optionCheckboxes
                        .map(cb => cb.dataset.value)
                        .filter(Boolean);

                    // 全选时，记录所有新增的选项到选择顺序中
                    this.selectionOrder = [...this.selectedValues];

                    optionCheckboxes.forEach(cb => cb.checked = true);
                } else {
                    this.selectedValues = [];
                    this.selectionOrder = []; // 清空选择顺序
                    optionCheckboxes.forEach(cb => cb.checked = false);
                }

                this.updateDisplay();
                this.updateTags();

                if (this.onChange) this.onChange([...this.selectedValues]);
                this.openDropdown();
            });
        }

        const isAllSelected = visibleOptionsCount > 0 && selectedCount === visibleOptionsCount;
        checkbox.checked = isAllSelected;
    }

    updateDisplay() {
        const displayEl = document.getElementById(this.displayId);
        if (!displayEl) return;
        if (this.selectedValues.length === 0) {
            displayEl.textContent = '请选择';
        } else if (this.selectedValues.length === 1) {
            const selectedOption = this.allOptions.find(opt => opt.value === this.selectedValues[0]);
            displayEl.textContent = selectedOption ? selectedOption.label : '已选择';
        } else if (this.selectedValues.length === this.allOptions.length) {
            displayEl.textContent = '全部已选择';
        } else {
            displayEl.textContent = `已选择 ${this.selectedValues.length} 项`;
        }

        const hiddenInput = document.getElementById(this.valueId);
        if (hiddenInput) hiddenInput.value = JSON.stringify(this.selectedValues);
    }

    updateTags() {
        const tagsContainer = document.getElementById(this.tagsId);
        const searchInput = document.getElementById(this.searchId);

        if (!tagsContainer) return;

        // 清空容器
        tagsContainer.innerHTML = '';

        // 没有选择时，占位符显示在搜索框中
        if (this.selectedValues.length === 0) {
            if (searchInput) {
                searchInput.placeholder = '请选择...';
            }
            return;
        }

        // 有选择时，清空搜索框占位符
        if (searchInput) {
            searchInput.placeholder = '';
        }

        // 显示第一个标签
        const firstValue = this.selectedValues[0];
        const firstOption = this.allOptions.find(opt => opt.value === firstValue);

        if (firstOption) {
            const tagEl = document.createElement('div');
            tagEl.className = 'selected-tag-inline';
            tagEl.innerHTML = `
                <span class="tag-label" title="${firstOption.label}">${firstOption.label}</span>
                <span class="tag-remove" data-value="${firstValue}">×</span>
            `;

            tagEl.querySelector('.tag-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelection(firstValue, false);
            });

            tagsContainer.appendChild(tagEl);
        }

        // 如果有更多选项，显示 +N
        if (this.selectedValues.length > 1) {
            const moreCount = document.createElement('span');
            moreCount.className = 'more-count';
            moreCount.textContent = `+${this.selectedValues.length - 1}`;
            moreCount.title = `已选择 ${this.selectedValues.length} 项`;
            tagsContainer.appendChild(moreCount);
        }
    }

    clearSelection() {
        this.selectedValues = [];
        this.selectionOrder = []; // 清空选择顺序
        this.updateDisplay();
        this.updateTags();
        this.updateSelectAllStatus();
        const searchInput = document.getElementById(this.searchId);
        this.renderOptions(searchInput ? searchInput.value : '');
        if (this.onChange) this.onChange([]);
    }

    /**
     * 删除最新添加的选项（按Backspace键时调用）
     */
    removeLatestSelection() {
        // 如果没有选中的项，直接返回
        if (this.selectionOrder.length === 0) {
            return;
        }

        // 获取最后添加的选项
        const latestValue = this.selectionOrder[this.selectionOrder.length - 1];

        // 取消选择该选项
        this.toggleSelection(latestValue, false);
    }

    toggleDropdown() {
        const optionsContainer = document.getElementById(this.optionsId);
        const dropdownEl = document.getElementById(this.dropdownId);
        if (!optionsContainer) return;

        const isOpen = !optionsContainer.classList.contains('hidden');
        if (isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    closeDropdown() {
        const optionsContainer = document.getElementById(this.optionsId);
        const dropdownEl = document.getElementById(this.dropdownId);
        if (!optionsContainer) return;

        optionsContainer.classList.add('hidden');
        if (dropdownEl) {
            dropdownEl.classList.remove('dropdown-open');
        }

        // 关闭下拉框时移除键盘事件监听器
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    openDropdown() {
        const optionsContainer = document.getElementById(this.optionsId);
        const dropdownEl = document.getElementById(this.dropdownId);
        if (!optionsContainer) return;

        optionsContainer.classList.remove('hidden');
        if (dropdownEl) {
            dropdownEl.classList.add('dropdown-open');
        }

        // 打开下拉框时添加键盘事件监听器
        document.addEventListener('keydown', this.handleKeyDown);
    }

    getSelectedValues() {
        return [...this.selectedValues];
    }

    // 【双向同步】设置选中的值（不触发 onChange 回调）
    setSelectedValues(values) {
        // 设置选中的值
        this.selectedValues = [...values];
        // 同步选择顺序
        this.selectionOrder = [...values];

        // 更新显示
        this.updateDisplay();
        this.updateTags();

        // 更新复选框状态
        const optionsContainer = document.getElementById(this.optionsId);
        if (optionsContainer) {
            const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                const value = cb.dataset.value;
                if (value) {
                    cb.checked = this.selectedValues.includes(value);
                }
            });
        }

        // 更新全选状态
        this.updateSelectAllStatus();
    }
}
