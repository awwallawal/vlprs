import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText('VLPRS')).toBeInTheDocument();
  });

  it('renders shadcn/ui Button component', () => {
    render(<App />);
    expect(screen.getByText('Primary Action')).toBeInTheDocument();
  });
});
