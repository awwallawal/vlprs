import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FileUploadZone } from './FileUploadZone';

describe('FileUploadZone', () => {
  const defaultProps = {
    onFileSelect: vi.fn(),
  };

  it('renders upload area with default instructions', () => {
    render(<FileUploadZone {...defaultProps} />);
    expect(screen.getByLabelText(/Upload CSV file/)).toBeInTheDocument();
  });

  it('renders drag-and-drop hint on desktop', () => {
    render(<FileUploadZone {...defaultProps} />);
    expect(screen.getByText(/Drag and drop/)).toBeInTheDocument();
  });

  it('calls onFileSelect when file is dropped', () => {
    const onFileSelect = vi.fn();
    render(<FileUploadZone onFileSelect={onFileSelect} />);
    const dropZone = screen.getByLabelText(/Upload CSV file/);
    const file = new File(['csv data'], 'test.csv', { type: 'text/csv' });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });
    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('renders success state with filename', () => {
    render(<FileUploadZone {...defaultProps} status="success" fileName="report.csv" />);
    expect(screen.getByText('report.csv')).toBeInTheDocument();
  });

  it('renders error state with "Upload needs attention" text', () => {
    render(<FileUploadZone {...defaultProps} status="error" errorMessage="File too large" />);
    expect(screen.getByText('Upload needs attention')).toBeInTheDocument();
    expect(screen.getByText('File too large')).toBeInTheDocument();
  });

  it('NEVER says "Upload failed" or "Error" in error state', () => {
    const { container } = render(
      <FileUploadZone {...defaultProps} status="error" errorMessage="File too large" />
    );
    const text = container.textContent || '';
    expect(text).not.toContain('Upload failed');
    // "Error" as standalone word check - allow "errorMessage" in attributes but not visible text
    expect(text).not.toMatch(/\bError\b/);
  });

  it('renders progress bar during upload', () => {
    render(<FileUploadZone {...defaultProps} status="uploading" progress={45} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '45');
  });

  it('renders template download link when provided', () => {
    render(<FileUploadZone {...defaultProps} templateDownloadUrl="/template.csv" />);
    expect(screen.getByText('Download template')).toBeInTheDocument();
  });

  it('hides template link in success state', () => {
    render(
      <FileUploadZone {...defaultProps} status="success" fileName="test.csv" templateDownloadUrl="/template.csv" />
    );
    expect(screen.queryByText('Download template')).not.toBeInTheDocument();
  });

  it('triggers file input on click', () => {
    render(<FileUploadZone {...defaultProps} />);
    const dropZone = screen.getByLabelText(/Upload CSV file/);
    // Clicking the drop zone should not throw
    fireEvent.click(dropZone);
  });

  it('has correct aria-label on drop zone', () => {
    render(<FileUploadZone {...defaultProps} />);
    const dropZone = screen.getByLabelText('Upload CSV file. Drag and drop or click to browse.');
    expect(dropZone).toBeInTheDocument();
  });

  it('shows dragover styling on dragOver and reverts on dragLeave', () => {
    const { container } = render(<FileUploadZone {...defaultProps} />);
    const dropZone = screen.getByLabelText(/Upload CSV file/);

    // Simulate dragOver — should apply teal bg
    fireEvent.dragOver(dropZone);
    expect((container.firstChild as HTMLElement).className).toContain('bg-teal-50');

    // Simulate dragLeave — should revert to idle
    fireEvent.dragLeave(dropZone);
    expect((container.firstChild as HTMLElement).className).not.toContain('bg-teal-50');
  });

  it('clears dragover state after drop', () => {
    const onFileSelect = vi.fn();
    const { container } = render(<FileUploadZone onFileSelect={onFileSelect} />);
    const dropZone = screen.getByLabelText(/Upload CSV file/);

    fireEvent.dragOver(dropZone);
    expect((container.firstChild as HTMLElement).className).toContain('bg-teal-50');

    const file = new File(['csv data'], 'test.csv', { type: 'text/csv' });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    expect((container.firstChild as HTMLElement).className).not.toContain('bg-teal-50');
  });
});
