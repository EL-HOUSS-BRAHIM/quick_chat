/**
 * DataTable Component - Advanced table with sorting, filtering, pagination
 * @module components/ui/DataTable
 */

export class DataTable {
    constructor(options = {}) {
        this.options = {
            data: [],
            columns: [],
            sortable: true,
            filterable: true,
            paginated: true,
            pageSize: 10,
            selectable: false,
            multiSelect: false,
            responsive: true,
            className: '',
            emptyMessage: 'No data available',
            loadingMessage: 'Loading...',
            ...options
        };

        this.state = {
            currentPage: 1,
            sortColumn: null,
            sortDirection: 'asc',
            filters: {},
            selectedRows: new Set(),
            loading: false
        };

        this.element = null;
        this.render();
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = `datatable ${this.options.responsive ? 'datatable--responsive' : ''} ${this.options.className}`;
        
        this.element.innerHTML = this.getTableHTML();
        this.setupEventListeners();
        
        return this.element;
    }

    getTableHTML() {
        if (this.state.loading) {
            return `<div class="datatable__loading">${this.options.loadingMessage}</div>`;
        }

        const filteredData = this.getFilteredData();
        const sortedData = this.getSortedData(filteredData);
        const paginatedData = this.getPaginatedData(sortedData);

        return `
            ${this.options.filterable ? this.getFiltersHTML() : ''}
            
            <div class="datatable__wrapper">
                <table class="datatable__table">
                    <thead class="datatable__head">
                        ${this.getHeaderHTML()}
                    </thead>
                    <tbody class="datatable__body">
                        ${paginatedData.length > 0 ? paginatedData.map((row, index) => this.getRowHTML(row, index)).join('') : this.getEmptyRowHTML()}
                    </tbody>
                </table>
            </div>
            
            ${this.options.paginated ? this.getPaginationHTML(filteredData.length) : ''}
            
            ${this.options.selectable ? this.getSelectionActionsHTML() : ''}
        `;
    }

    getFiltersHTML() {
        return `
            <div class="datatable__filters">
                ${this.options.columns.filter(col => col.filterable !== false).map(column => `
                    <div class="datatable__filter">
                        <label for="filter-${column.key}">${column.label}:</label>
                        <input 
                            type="text" 
                            id="filter-${column.key}"
                            class="datatable__filter-input"
                            data-column="${column.key}"
                            placeholder="Filter ${column.label.toLowerCase()}..."
                            value="${this.state.filters[column.key] || ''}"
                        >
                    </div>
                `).join('')}
                <button class="btn btn--secondary datatable__clear-filters">Clear Filters</button>
            </div>
        `;
    }

    getHeaderHTML() {
        const selectAllCell = this.options.selectable && this.options.multiSelect ? 
            `<th class="datatable__select-all">
                <input type="checkbox" class="datatable__select-all-checkbox" 
                       ${this.isAllSelected() ? 'checked' : ''}>
            </th>` : 
            (this.options.selectable ? '<th class="datatable__select"></th>' : '');

        const columnHeaders = this.options.columns.map(column => {
            const sortable = this.options.sortable && column.sortable !== false;
            const isSorted = this.state.sortColumn === column.key;
            const sortDirection = isSorted ? this.state.sortDirection : '';

            return `
                <th class="datatable__header ${sortable ? 'datatable__header--sortable' : ''} ${isSorted ? `datatable__header--sorted-${sortDirection}` : ''}"
                    ${sortable ? `data-column="${column.key}"` : ''}>
                    ${column.label}
                    ${sortable ? `<span class="datatable__sort-icon">${this.getSortIcon(isSorted, sortDirection)}</span>` : ''}
                </th>
            `;
        }).join('');

        return `<tr>${selectAllCell}${columnHeaders}</tr>`;
    }

    getRowHTML(row, index) {
        const selectCell = this.options.selectable ? 
            `<td class="datatable__select">
                <input type="${this.options.multiSelect ? 'checkbox' : 'radio'}" 
                       class="datatable__row-select"
                       name="${this.options.multiSelect ? '' : 'datatable-select'}"
                       value="${index}"
                       ${this.state.selectedRows.has(index) ? 'checked' : ''}>
            </td>` : '';

        const cells = this.options.columns.map(column => {
            const value = this.getCellValue(row, column.key);
            const formattedValue = column.formatter ? column.formatter(value, row) : value;
            
            return `<td class="datatable__cell" data-label="${column.label}">${formattedValue}</td>`;
        }).join('');

        return `<tr class="datatable__row ${this.state.selectedRows.has(index) ? 'datatable__row--selected' : ''}" data-index="${index}">${selectCell}${cells}</tr>`;
    }

    getEmptyRowHTML() {
        const colspan = this.options.columns.length + (this.options.selectable ? 1 : 0);
        return `<tr><td colspan="${colspan}" class="datatable__empty">${this.options.emptyMessage}</td></tr>`;
    }

    getPaginationHTML(totalItems) {
        const totalPages = Math.ceil(totalItems / this.options.pageSize);
        const currentPage = this.state.currentPage;

        if (totalPages <= 1) return '';

        const startItem = (currentPage - 1) * this.options.pageSize + 1;
        const endItem = Math.min(currentPage * this.options.pageSize, totalItems);

        return `
            <div class="datatable__pagination">
                <div class="datatable__pagination-info">
                    Showing ${startItem}-${endItem} of ${totalItems} items
                </div>
                
                <div class="datatable__pagination-controls">
                    <button class="btn btn--secondary datatable__page-btn" 
                            data-page="${currentPage - 1}" 
                            ${currentPage === 1 ? 'disabled' : ''}>
                        Previous
                    </button>
                    
                    ${this.getPageNumbers(currentPage, totalPages)}
                    
                    <button class="btn btn--secondary datatable__page-btn" 
                            data-page="${currentPage + 1}" 
                            ${currentPage === totalPages ? 'disabled' : ''}>
                        Next
                    </button>
                </div>
            </div>
        `;
    }

    getPageNumbers(currentPage, totalPages) {
        const pages = [];
        const maxVisiblePages = 5;
        
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(`
                <button class="btn ${i === currentPage ? 'btn--primary' : 'btn--secondary'} datatable__page-btn" 
                        data-page="${i}">
                    ${i}
                </button>
            `);
        }

        return pages.join('');
    }

    getSelectionActionsHTML() {
        const selectedCount = this.state.selectedRows.size;
        
        if (selectedCount === 0) return '';

        return `
            <div class="datatable__selection-actions">
                <span class="datatable__selection-count">${selectedCount} item${selectedCount > 1 ? 's' : ''} selected</span>
                <button class="btn btn--secondary datatable__clear-selection">Clear Selection</button>
                ${this.options.onBulkAction ? '<button class="btn btn--primary datatable__bulk-action">Bulk Action</button>' : ''}
            </div>
        `;
    }

    getSortIcon(isSorted, direction) {
        if (!isSorted) return '↕️';
        return direction === 'asc' ? '↑' : '↓';
    }

    setupEventListeners() {
        // Sorting
        this.element.addEventListener('click', (e) => {
            const header = e.target.closest('.datatable__header--sortable');
            if (header) {
                this.handleSort(header.dataset.column);
            }

            // Row selection
            const rowSelect = e.target.closest('.datatable__row-select');
            if (rowSelect) {
                this.handleRowSelection(parseInt(rowSelect.value), rowSelect.checked);
            }

            // Select all
            const selectAll = e.target.closest('.datatable__select-all-checkbox');
            if (selectAll) {
                this.handleSelectAll(selectAll.checked);
            }

            // Pagination
            const pageBtn = e.target.closest('.datatable__page-btn');
            if (pageBtn && !pageBtn.disabled) {
                this.goToPage(parseInt(pageBtn.dataset.page));
            }

            // Clear selection
            const clearSelection = e.target.closest('.datatable__clear-selection');
            if (clearSelection) {
                this.clearSelection();
            }

            // Clear filters
            const clearFilters = e.target.closest('.datatable__clear-filters');
            if (clearFilters) {
                this.clearFilters();
            }

            // Bulk action
            const bulkAction = e.target.closest('.datatable__bulk-action');
            if (bulkAction && this.options.onBulkAction) {
                this.options.onBulkAction(this.getSelectedData());
            }
        });

        // Filtering
        this.element.addEventListener('input', (e) => {
            const filterInput = e.target.closest('.datatable__filter-input');
            if (filterInput) {
                this.handleFilter(filterInput.dataset.column, filterInput.value);
            }
        });
    }

    // Data processing methods
    getFilteredData() {
        let data = [...this.options.data];
        
        Object.entries(this.state.filters).forEach(([column, value]) => {
            if (value.trim()) {
                data = data.filter(row => {
                    const cellValue = this.getCellValue(row, column);
                    return String(cellValue).toLowerCase().includes(value.toLowerCase());
                });
            }
        });

        return data;
    }

    getSortedData(data) {
        if (!this.state.sortColumn) return data;

        return [...data].sort((a, b) => {
            const aValue = this.getCellValue(a, this.state.sortColumn);
            const bValue = this.getCellValue(b, this.state.sortColumn);
            
            let comparison = 0;
            if (aValue > bValue) comparison = 1;
            if (aValue < bValue) comparison = -1;
            
            return this.state.sortDirection === 'desc' ? -comparison : comparison;
        });
    }

    getPaginatedData(data) {
        if (!this.options.paginated) return data;
        
        const start = (this.state.currentPage - 1) * this.options.pageSize;
        const end = start + this.options.pageSize;
        
        return data.slice(start, end);
    }

    getCellValue(row, key) {
        return key.includes('.') ? 
            key.split('.').reduce((obj, k) => obj?.[k], row) : 
            row[key];
    }

    // Event handlers
    handleSort(column) {
        if (this.state.sortColumn === column) {
            this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.sortColumn = column;
            this.state.sortDirection = 'asc';
        }
        
        this.update();
    }

    handleFilter(column, value) {
        this.state.filters[column] = value;
        this.state.currentPage = 1; // Reset to first page
        this.update();
    }

    handleRowSelection(index, checked) {
        if (this.options.multiSelect) {
            if (checked) {
                this.state.selectedRows.add(index);
            } else {
                this.state.selectedRows.delete(index);
            }
        } else {
            this.state.selectedRows.clear();
            if (checked) {
                this.state.selectedRows.add(index);
            }
        }
        
        this.update();
        
        if (this.options.onSelectionChange) {
            this.options.onSelectionChange(this.getSelectedData());
        }
    }

    handleSelectAll(checked) {
        if (checked) {
            const currentData = this.getPaginatedData(this.getSortedData(this.getFilteredData()));
            currentData.forEach((_, index) => {
                this.state.selectedRows.add(index);
            });
        } else {
            this.state.selectedRows.clear();
        }
        
        this.update();
        
        if (this.options.onSelectionChange) {
            this.options.onSelectionChange(this.getSelectedData());
        }
    }

    // Public API methods
    setData(data) {
        this.options.data = data;
        this.state.currentPage = 1;
        this.state.selectedRows.clear();
        this.update();
    }

    goToPage(page) {
        this.state.currentPage = page;
        this.update();
    }

    clearSelection() {
        this.state.selectedRows.clear();
        this.update();
        
        if (this.options.onSelectionChange) {
            this.options.onSelectionChange([]);
        }
    }

    clearFilters() {
        this.state.filters = {};
        this.state.currentPage = 1;
        
        // Clear filter inputs
        this.element.querySelectorAll('.datatable__filter-input').forEach(input => {
            input.value = '';
        });
        
        this.update();
    }

    getSelectedData() {
        const currentData = this.getSortedData(this.getFilteredData());
        return Array.from(this.state.selectedRows).map(index => currentData[index]).filter(Boolean);
    }

    isAllSelected() {
        const currentData = this.getPaginatedData(this.getSortedData(this.getFilteredData()));
        return currentData.length > 0 && currentData.every((_, index) => this.state.selectedRows.has(index));
    }

    setLoading(loading) {
        this.state.loading = loading;
        this.update();
    }

    update() {
        this.element.innerHTML = this.getTableHTML();
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }

    getElement() {
        return this.element;
    }
}

export default DataTable;