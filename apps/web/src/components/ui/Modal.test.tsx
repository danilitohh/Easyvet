import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Modal } from './Modal';

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Demo modal">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('closes with Escape and restores focus to the trigger', () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('button', { name: 'Cerrar diálogo' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps keyboard focus inside the dialog when tabbing in either direction', () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    fireEvent.click(trigger);
    const closeButton = screen.getByRole('button', { name: 'Cerrar diálogo' });
    const lastAction = screen.getByRole('button', { name: 'Last action' });

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastAction).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    trigger.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
  });

  it('gives each mounted dialog unique labelled-by and described-by references', () => {
    render(
      <>
        <Modal open onClose={() => undefined} title="First" description="First description">
          <p>First body</p>
        </Modal>
        <Modal open onClose={() => undefined} title="Second" description="Second description">
          <p>Second body</p>
        </Modal>
      </>,
    );

    const dialogs = screen.getAllByRole('dialog');
    const labelledBy = dialogs.map((dialog) => dialog.getAttribute('aria-labelledby'));
    const describedBy = dialogs.map((dialog) => dialog.getAttribute('aria-describedby'));

    expect(new Set(labelledBy).size).toBe(2);
    expect(new Set(describedBy).size).toBe(2);
    for (const dialog of dialogs) {
      expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)).toBeInTheDocument();
      expect(document.getElementById(dialog.getAttribute('aria-describedby')!)).toBeInTheDocument();
    }
  });
});
