import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { preloadRoute } from '../../routes/routePreload';

const NavigationFeedbackContext = createContext({
  pendingPath: '',
  beginNavigation: () => {},
});

function internalPath(anchor) {
  const href = anchor?.getAttribute('href') || '';
  if (!href.startsWith('#/')) return '';
  return href.slice(1).split('?')[0];
}

export function NavigationFeedbackProvider({ children }) {
  const { pathname } = useLocation();
  const [pendingPath, setPendingPath] = useState('');

  const beginNavigation = useCallback(
    (nextPath) => {
      if (nextPath && nextPath !== pathname) setPendingPath(nextPath);
    },
    [pathname],
  );

  useEffect(() => {
    if (!pendingPath) return undefined;
    const frame = window.requestAnimationFrame(() => setPendingPath(''));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const handlePointerOver = (event) => {
    const path = internalPath(event.target.closest('a'));
    if (path) preloadRoute(path);
  };

  const handlePointerDown = (event) => {
    const path = internalPath(event.target.closest('a'));
    if (path) preloadRoute(path);
  };

  const handleClick = (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    beginNavigation(internalPath(event.target.closest('a')));
  };

  const value = useMemo(
    () => ({ pendingPath, beginNavigation }),
    [beginNavigation, pendingPath],
  );

  return (
    <NavigationFeedbackContext.Provider value={value}>
      <div
        onClickCapture={handleClick}
        onPointerDownCapture={handlePointerDown}
        onPointerOverCapture={handlePointerOver}
      >
        {pendingPath && (
          <div
            className="route-progress fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-cyan-100"
            role="progressbar"
            aria-label="Opening page"
          >
            <span className="block h-full bg-teal-600" />
          </div>
        )}
        {children}
      </div>
    </NavigationFeedbackContext.Provider>
  );
}

export function useNavigationFeedback() {
  return useContext(NavigationFeedbackContext);
}
