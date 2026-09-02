import { useCallback, useRef, useState } from 'react';

// Clean: the Dialog overlay is given an onClose handler that restores focus to the trigger
// element -- FIGM-A11Y-04 must NOT fire (its detector uses a real onClose prop as the proxy
// signal for focus-restoration handling). Handlers are hoisted/useCallback-wrapped rather than
// inline arrow function literals in JSX props, to also stay compliant with FIGM-PERF-05.
export function ModalTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);

  const handleOpen = useCallback(() => setIsOpen(true), []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <button ref={triggerRef} onClick={handleOpen}>
        Open Dialog
      </button>
      {isOpen && <Dialog onClose={handleClose}>Content</Dialog>}
    </>
  );
}

function Dialog({ children, onClose }) {
  return (
    <div role="dialog" aria-modal="true">
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  );
}
