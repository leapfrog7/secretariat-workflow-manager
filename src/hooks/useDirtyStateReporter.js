import { useEffect, useRef } from 'react';

export default function useDirtyStateReporter(dirty, onDirtyChange) {
  const callbackRef = useRef(onDirtyChange);
  callbackRef.current = onDirtyChange;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => {
    callbackRef.current?.(false);
  }, []);
}
