// src/tests/StatementImportOverlay.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatementImportOverlay from '../components/StatementImportOverlay.jsx';

const data = {
  primaryCurrency: 'USD',
  transactions: [],
  incomeGroups: [{ name: 'Income', categories: ['Salary'] }],
  expenseGroups: [{ name: 'Spending', categories: ['Groceries'] }],
  merchantMemory: {},
};
const noop = () => {};

describe('StatementImportOverlay', () => {
  it('shows the key gate when no API key is set', () => {
    render(<StatementImportOverlay open data={data} apiKey="" onConfirm={noop} update={noop} onClose={noop} />);
    expect(screen.getByText(/need an Anthropic API key/i)).toBeInTheDocument();
  });

  it('shows the upload zone when a key is present', () => {
    render(<StatementImportOverlay open data={data} apiKey="sk-ant-x" onConfirm={noop} update={noop} onClose={noop} />);
    expect(screen.getByText(/Drag your bank or card CSV/i)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<StatementImportOverlay open={false} data={data} apiKey="sk-ant-x" onConfirm={noop} update={noop} onClose={noop} />);
    expect(container).toBeEmptyDOMElement();
  });
});
