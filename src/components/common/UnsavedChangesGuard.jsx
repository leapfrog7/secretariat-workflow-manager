import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import ConfirmDialog from './ConfirmDialog';

export default function UnsavedChangesGuard({ when, message = 'Your unsaved changes will be lost if you leave this page.' }) {
  const blocker = useBlocker(Boolean(when));

  useEffect(() => {
    if (!when) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [when]);

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="Leave without saving?"
      message={message}
      confirmLabel="Discard and leave"
      destructive
      onCancel={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
    />
  );
}
