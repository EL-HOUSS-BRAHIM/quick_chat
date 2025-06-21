/**
 * UI Components Test Suite
 * Tests for Card, DataTable, and other UI components
 */

import { Card } from '../../components/ui/Card.js';
import { DataTable } from '../../components/ui/DataTable.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Dropdown } from '../../components/ui/Dropdown.js';

// Mock DOM environment
global.document = {
  createElement: jest.fn(() => ({
    className: '',
    innerHTML: '',
    setAttribute: jest.fn(),
    addEventListener: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn()
    },
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    insertAdjacentHTML: jest.fn(),
    remove: jest.fn()
  }))
};

describe('UI Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Card Component', () => {
    test('should create a basic card', () => {
      const card = new Card({
        title: 'Test Card',
        content: 'Test content'
      });

      expect(card.element).toBeDefined();
      expect(card.options.title).toBe('Test Card');
      expect(card.options.content).toBe('Test content');
    });

    test('should handle interactive cards', () => {
      const mockClickHandler = jest.fn();
      const card = new Card({
        title: 'Interactive Card',
        interactive: true,
        onClick: mockClickHandler
      });

      card.handleClick({ preventDefault: jest.fn() });
      expect(mockClickHandler).toHaveBeenCalled();
    });

    test('should support loading state', () => {
      const card = new Card({
        title: 'Loading Card',
        loading: true
      });

      expect(card.options.loading).toBe(true);
      
      card.setLoading(false);
      expect(card.options.loading).toBe(false);
    });

    test('should create simple card using static method', () => {
      const card = Card.createSimple('Simple content');
      expect(card.options.content).toBe('Simple content');
      expect(card.options.variant).toBe('outlined');
    });

    test('should create card with actions', () => {
      const actions = [
        { label: 'Action 1', callback: jest.fn(), variant: 'primary' },
        { label: 'Action 2', callback: jest.fn(), variant: 'secondary' }
      ];

      const card = Card.createWithActions('Title', 'Content', actions);
      expect(card.options.title).toBe('Title');
      expect(card.options.variant).toBe('elevated');
    });
  });

  describe('DataTable Component', () => {
    const sampleData = [
      { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'active' }
    ];

    const sampleColumns = [
      { key: 'id', label: 'ID', sortable: true },
      { key: 'name', label: 'Name', sortable: true, filterable: true },
      { key: 'email', label: 'Email', sortable: true, filterable: true },
      { key: 'status', label: 'Status', formatter: (value) => value.toUpperCase() }
    ];

    test('should create a basic datatable', () => {
      const table = new DataTable({
        data: sampleData,
        columns: sampleColumns
      });

      expect(table.element).toBeDefined();
      expect(table.options.data).toEqual(sampleData);
      expect(table.options.columns).toEqual(sampleColumns);
    });

    test('should handle sorting', () => {
      const table = new DataTable({
        data: sampleData,
        columns: sampleColumns,
        sortable: true
      });

      table.handleSort('name');
      expect(table.state.sortColumn).toBe('name');
      expect(table.state.sortDirection).toBe('asc');

      table.handleSort('name');
      expect(table.state.sortDirection).toBe('desc');
    });

    test('should handle filtering', () => {
      const table = new DataTable({
        data: sampleData,
        columns: sampleColumns,
        filterable: true
      });

      table.handleFilter('name', 'John');
      expect(table.state.filters.name).toBe('John');

      const filteredData = table.getFilteredData();
      expect(filteredData).toHaveLength(1);
      expect(filteredData[0].name).toBe('John Doe');
    });

    test('should handle pagination', () => {
      const table = new DataTable({
        data: sampleData,
        columns: sampleColumns,
        paginated: true,
        pageSize: 2
      });

      const paginatedData = table.getPaginatedData(sampleData);
      expect(paginatedData).toHaveLength(2);

      table.goToPage(2);
      expect(table.state.currentPage).toBe(2);
    });

    test('should handle row selection', () => {
      const mockSelectionHandler = jest.fn();
      const table = new DataTable({
        data: sampleData,
        columns: sampleColumns,
        selectable: true,
        multiSelect: true,
        onSelectionChange: mockSelectionHandler
      });

      table.handleRowSelection(0, true);
      expect(table.state.selectedRows.has(0)).toBe(true);
      expect(mockSelectionHandler).toHaveBeenCalled();

      table.handleRowSelection(1, true);
      expect(table.state.selectedRows.size).toBe(2);
    });

    test('should handle select all', () => {
      const table = new DataTable({
        data: sampleData,
        columns: sampleColumns,
        selectable: true,
        multiSelect: true
      });

      table.handleSelectAll(true);
      expect(table.state.selectedRows.size).toBeGreaterThan(0);

      table.handleSelectAll(false);
      expect(table.state.selectedRows.size).toBe(0);
    });

    test('should clear filters', () => {
      const table = new DataTable({
        data: sampleData,
        columns: sampleColumns,
        filterable: true
      });

      table.handleFilter('name', 'John');
      table.handleFilter('status', 'active');
      expect(Object.keys(table.state.filters)).toHaveLength(2);

      table.clearFilters();
      expect(Object.keys(table.state.filters)).toHaveLength(0);
      expect(table.state.currentPage).toBe(1);
    });

    test('should handle loading state', () => {
      const table = new DataTable({
        data: sampleData,
        columns: sampleColumns
      });

      table.setLoading(true);
      expect(table.state.loading).toBe(true);

      table.setLoading(false);
      expect(table.state.loading).toBe(false);
    });
  });

  describe('Button Component', () => {
    test('should create a basic button', () => {
      const button = new Button({
        text: 'Test Button',
        variant: 'primary'
      });

      expect(button.element).toBeDefined();
      expect(button.options.text).toBe('Test Button');
      expect(button.options.variant).toBe('primary');
    });

    test('should handle click events', () => {
      const mockClickHandler = jest.fn();
      const button = new Button({
        text: 'Clickable Button',
        onClick: mockClickHandler
      });

      button.handleClick({ preventDefault: jest.fn() });
      expect(mockClickHandler).toHaveBeenCalled();
    });

    test('should handle disabled state', () => {
      const button = new Button({
        text: 'Disabled Button',
        disabled: true
      });

      expect(button.options.disabled).toBe(true);
      
      button.setDisabled(false);
      expect(button.options.disabled).toBe(false);
    });

    test('should handle loading state', () => {
      const button = new Button({
        text: 'Loading Button'
      });

      button.setLoading(true);
      expect(button.options.loading).toBe(true);

      button.setLoading(false);
      expect(button.options.loading).toBe(false);
    });
  });

  describe('Input Component', () => {
    test('should create a basic input', () => {
      const input = new Input({
        type: 'text',
        placeholder: 'Enter text',
        label: 'Test Input'
      });

      expect(input.element).toBeDefined();
      expect(input.options.type).toBe('text');
      expect(input.options.placeholder).toBe('Enter text');
    });

    test('should handle validation', () => {
      const input = new Input({
        type: 'email',
        required: true,
        validation: {
          email: true,
          minLength: 5
        }
      });

      const invalidResult = input.validate('abc');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Must be a valid email address');

      const validResult = input.validate('test@example.com');
      expect(validResult.isValid).toBe(true);
    });

    test('should handle focus and blur events', () => {
      const mockFocusHandler = jest.fn();
      const mockBlurHandler = jest.fn();
      
      const input = new Input({
        onFocus: mockFocusHandler,
        onBlur: mockBlurHandler
      });

      input.handleFocus({});
      expect(mockFocusHandler).toHaveBeenCalled();

      input.handleBlur({});
      expect(mockBlurHandler).toHaveBeenCalled();
    });
  });

  describe('Dropdown Component', () => {
    const sampleOptions = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
      { value: 'option3', label: 'Option 3' }
    ];

    test('should create a basic dropdown', () => {
      const dropdown = new Dropdown({
        options: sampleOptions,
        placeholder: 'Select an option'
      });

      expect(dropdown.element).toBeDefined();
      expect(dropdown.options.options).toEqual(sampleOptions);
      expect(dropdown.options.placeholder).toBe('Select an option');
    });

    test('should handle option selection', () => {
      const mockChangeHandler = jest.fn();
      const dropdown = new Dropdown({
        options: sampleOptions,
        onChange: mockChangeHandler
      });

      dropdown.selectOption('option2');
      expect(dropdown.state.selectedValue).toBe('option2');
      expect(mockChangeHandler).toHaveBeenCalledWith('option2', sampleOptions[1]);
    });

    test('should handle search functionality', () => {
      const dropdown = new Dropdown({
        options: sampleOptions,
        searchable: true
      });

      dropdown.handleSearch('Option 1');
      const filteredOptions = dropdown.getFilteredOptions();
      expect(filteredOptions).toHaveLength(1);
      expect(filteredOptions[0].label).toBe('Option 1');
    });

    test('should handle multiple selection', () => {
      const dropdown = new Dropdown({
        options: sampleOptions,
        multiple: true
      });

      dropdown.selectOption('option1');
      dropdown.selectOption('option2');
      
      expect(dropdown.state.selectedValues).toContain('option1');
      expect(dropdown.state.selectedValues).toContain('option2');
      expect(dropdown.state.selectedValues).toHaveLength(2);
    });

    test('should clear selection', () => {
      const dropdown = new Dropdown({
        options: sampleOptions,
        multiple: true
      });

      dropdown.selectOption('option1');
      dropdown.selectOption('option2');
      expect(dropdown.state.selectedValues).toHaveLength(2);

      dropdown.clearSelection();
      expect(dropdown.state.selectedValues).toHaveLength(0);
      expect(dropdown.state.selectedValue).toBeNull();
    });
  });

  describe('Component Integration', () => {
    test('should work together in a complex UI', () => {
      // Create a card with a datatable inside
      const table = new DataTable({
        data: [
          { id: 1, name: 'Test User', status: 'active' }
        ],
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' }
        ]
      });

      const card = new Card({
        title: 'User List',
        content: table.getElement().outerHTML
      });

      expect(card.element).toBeDefined();
      expect(table.element).toBeDefined();
    });

    test('should handle component destruction', () => {
      const card = new Card({ title: 'Test' });
      const table = new DataTable({ data: [], columns: [] });
      const button = new Button({ text: 'Test' });

      card.destroy();
      table.destroy();
      button.destroy();

      expect(card.element).toBeNull();
      expect(table.element).toBeNull();
      expect(button.element).toBeNull();
    });
  });
});
