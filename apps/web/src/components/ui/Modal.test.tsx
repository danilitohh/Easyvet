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
});
