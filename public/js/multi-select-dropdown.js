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
        this.allOptions = [];
        this.isAllSelected = false;

        this.init();
    }

    init() {
        const dropdownEl = document.getElementById(this.dropdownId);
        if (dropdownEl) {
            dropdownEl.addEventListener('click', (e) => {
                e.stopPropagation();
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

        while (optionsContainer.children.length > 2) {
            optionsContainer.removeChild(optionsContainer.lastChild);
        }

        const filteredOptions = this.allOptions.filter(option =>
            option.label.toLowerCase().includes(filter.toLowerCase())
        );

        console.warn(`🎨 [MultiSelect] 过滤后选项数: ${filteredOptions.length}`);

        filteredOptions.forEach(option => {
            const optionEl = document.createElement('div');
            optionEl.className = 'tab-item tab-item-inactive flex items-center p-2';
            optionEl.innerHTML = `
                <input type="checkbox" class="multiselect-checkbox"
                       data-value="${option.value}"
                       ${this.selectedValues.includes(option.value) ? 'checked' : ''}>
                <span>${option.label}</span>
            `;

            optionEl.querySelector('input').addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleSelection(option.value, e.target.checked);
            });

            optionEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target.tagName !== 'INPUT') {
                    const checkbox = optionEl.querySelector('input');
                    checkbox.checked = !checkbox.checked;
                    const ev = new Event('change', { bubbles: false });
                    checkbox.dispatchEvent(ev);
                }
            });

            optionsContainer.appendChild(optionEl);
        });

        this.updateSelectAllStatus();
    }

    filterOptions(keyword) {
        this.renderOptions(keyword);
    }

    toggleSelection(value, isChecked) {
        if (isChecked && !this.selectedValues.includes(value)) {
            this.selectedValues.push(value);
        } else if (!isChecked && this.selectedValues.includes(value)) {
            this.selectedValues = this.selectedValues.filter(v => v !== value);
        }

        this.updateDisplay();
        this.updateTags();
        this.updateSelectAllStatus();

        // 【自动清除搜索框】选择后自动清空搜索内容
        const searchEl = document.getElementById(this.searchId);
        if (searchEl) {
            searchEl.value = '';
            this.filterOptions(''); // 重置过滤，显示所有选项
        }

        if (this.onChange) {
            this.onChange([...this.selectedValues]);
        }

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

        if (!checkbox) {
            selectAllEl.innerHTML = '';

            checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'mr-1';
            checkbox.id = `${this.selectAllId}-checkbox`;

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

                    optionCheckboxes.forEach(cb => cb.checked = true);
                } else {
                    this.selectedValues = [];
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
        if (!tagsContainer) return;
        tagsContainer.innerHTML = '';

        if (this.selectedValues.length > 5) {
            const tagEl = document.createElement('div');
            tagEl.className = 'selected-tag';
            tagEl.innerHTML = `已选择 ${this.selectedValues.length} 项 <span class="tag-remove" data-clear="all">×</span>`;

            tagEl.querySelector('.tag-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearSelection();
            });

            tagsContainer.appendChild(tagEl);
            return;
        }

        this.selectedValues.forEach(value => {
            const option = this.allOptions.find(opt => opt.value === value);
            if (!option) return;

            const tagEl = document.createElement('div');
            tagEl.className = 'selected-tag';
            tagEl.innerHTML = `
                ${option.label}
                <span class="tag-remove" data-value="${value}">×</span>
            `;

            tagEl.querySelector('.tag-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelection(e.target.dataset.value, false);
            });

            tagsContainer.appendChild(tagEl);
        });
    }

    clearSelection() {
        this.selectedValues = [];
        this.updateDisplay();
        this.updateTags();
        this.updateSelectAllStatus();
        const searchInput = document.getElementById(this.searchId);
        this.renderOptions(searchInput ? searchInput.value : '');
        if (this.onChange) this.onChange([]);
    }

    toggleDropdown() {
        const optionsContainer = document.getElementById(this.optionsId);
        if (!optionsContainer) return;
        optionsContainer.classList.toggle('hidden');
    }

    closeDropdown() {
        const optionsContainer = document.getElementById(this.optionsId);
        if (!optionsContainer) return;
        optionsContainer.classList.add('hidden');
    }

    openDropdown() {
        const optionsContainer = document.getElementById(this.optionsId);
        if (!optionsContainer) return;
        optionsContainer.classList.remove('hidden');
    }

    getSelectedValues() {
        return [...this.selectedValues];
    }

    // 【双向同步】设置选中的值（不触发 onChange 回调）
    setSelectedValues(values) {
        // 设置选中的值
        this.selectedValues = [...values];

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
