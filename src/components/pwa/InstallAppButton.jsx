import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useToast } from '../common/ToastProvider';

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export default function InstallAppButton() {
  const { showToast } = useToast();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const capturePrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const markInstalled = () => {
      setInstallPrompt(null);
      setInstalled(true);
      showToast('Secretariat Workflow Manager has been installed.');
    };
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, [showToast]);

  if (installed) return null;

  const install = async () => {
    if (!installPrompt) {
      const appleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
      showToast(appleMobile
        ? 'To install: open the browser Share menu and choose Add to Home Screen.'
        : 'Open the browser menu and choose Install app or Add to Home screen.');
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice?.outcome !== 'accepted') showToast('Installation was not completed. You can try again from the browser menu.');
  };

  return (
    <button type="button" onClick={install} title="Install app" aria-label="Install Secretariat Workflow Manager" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800">
      <Download className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
