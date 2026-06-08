import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TutorialOverlay from '../components/TutorialOverlay.jsx';

function renderOverlay(props = {}) {
  return render(
    <TutorialOverlay open isFirstRun onComplete={() => {}} onClose={() => {}} {...props} />
  );
}

describe('TutorialOverlay', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <TutorialOverlay open={false} isFirstRun onComplete={() => {}} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('first-run: primary button persists via onComplete, not onClose', async () => {
    const onComplete = vi.fn();
    const onClose = vi.fn();
    renderOverlay({ isFirstRun: true, onComplete, onClose });

    await userEvent.click(screen.getByRole('button', { name: "Got it, let's go →" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('replay mode: primary button is "Close" and calls onClose, not onComplete; Skip is hidden', async () => {
    const onComplete = vi.fn();
    const onClose = vi.fn();
    renderOverlay({ isFirstRun: false, onComplete, onClose });

    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('Skip is shown only on first run and dismisses without persisting', async () => {
    const onComplete = vi.fn();
    const onClose = vi.fn();
    renderOverlay({ isFirstRun: true, onComplete, onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('Escape dismisses via onClose', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop dismisses; clicking inside the dialog does not', () => {
    const onClose = vi.fn();
    const { container } = renderOverlay({ onClose });

    fireEvent.mouseDown(container.querySelector('.tutorial-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('locks body scroll while open and restores the prior value on close', () => {
    document.body.style.overflow = 'auto';
    const { rerender } = renderOverlay({ open: true });
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<TutorialOverlay open={false} isFirstRun onComplete={() => {}} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('moves focus into the dialog on open and restores it to the trigger on close', () => {
    render(
      <div>
        <button>Open tutorial</button>
      </div>
    );
    const trigger = screen.getByRole('button', { name: 'Open tutorial' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = renderOverlay({ open: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close tutorial' }));

    rerender(<TutorialOverlay open={false} isFirstRun onComplete={() => {}} onClose={() => {}} />);
    expect(document.activeElement).toBe(trigger);
  });

  it('traps Tab/Shift+Tab cycling between the first and last focusable elements', () => {
    renderOverlay({ isFirstRun: true });
    const closeBtn = screen.getByRole('button', { name: 'Close tutorial' });
    const primaryBtn = screen.getByRole('button', { name: "Got it, let's go →" });

    primaryBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(primaryBtn);
  });
});
