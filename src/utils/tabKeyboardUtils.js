export function nextTabIndex(key, currentIndex, tabCount) {
  if (!tabCount) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return tabCount - 1;
  if (key === 'ArrowRight') return (currentIndex + 1 + tabCount) % tabCount;
  if (key === 'ArrowLeft') return (currentIndex - 1 + tabCount) % tabCount;
  return -1;
}

export function handleTabListKeyDown(event) {
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]:not([disabled])')];
  const currentIndex = tabs.indexOf(document.activeElement);
  const targetIndex = nextTabIndex(event.key, currentIndex < 0 ? 0 : currentIndex, tabs.length);
  if (targetIndex < 0) return;
  event.preventDefault();
  tabs[targetIndex].focus();
  tabs[targetIndex].click();
}
