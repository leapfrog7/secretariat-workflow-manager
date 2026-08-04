import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, details) {
    console.error('Application rendering failed.', error, details);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6f5] px-4 py-10">
        <section className="w-full max-w-lg rounded-md border border-red-200 bg-white p-5 shadow-lg" role="alert">
          <AlertTriangle className="h-7 w-7 text-red-700" aria-hidden="true" />
          <h1 className="mt-4 text-lg font-semibold text-slate-950">The application could not display this page</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your locally saved workspace data has not been removed. Reload the application to recover the screen.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"><RefreshCw className="h-4 w-4" />Reload application</button>
        </section>
      </main>
    );
  }
}
