import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  FilePlus2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_PREFIX = "swm:welcome-dismissed:";

export default function WelcomeBanner({ userId, canEdit = false }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId) {
      setVisible(false);
      return;
    }

    const storageKey = `${STORAGE_PREFIX}${userId}`;

    try {
      setVisible(localStorage.getItem(storageKey) !== "true");
    } catch {
      // Show the banner when browser storage is unavailable.
      setVisible(true);
    }
  }, [userId]);

  const dismiss = () => {
    if (userId) {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${userId}`, "true");
      } catch {
        // Still dismiss for the current session.
      }
    }

    setVisible(false);
  };

  if (!visible) return null;

  return (
    <section
      aria-labelledby="welcome-title"
      className="
        relative mb-5 overflow-hidden rounded-xl
        border border-teal-200/80
        bg-gradient-to-r from-teal-50 via-white to-emerald-50
        shadow-sm
      "
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-teal-600"
      />

      <button
        type="button"
        onClick={dismiss}
        title="Dismiss welcome message"
        aria-label="Dismiss welcome message"
        className="
          absolute right-2.5 top-2.5 z-10
          inline-flex h-8 w-8 items-center justify-center
          rounded-lg text-slate-500
          transition-colors
          hover:bg-white hover:text-slate-800
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-teal-600
          focus-visible:ring-offset-2
        "
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="flex items-start gap-3 px-4 py-4 pr-12 sm:gap-4 sm:px-5 sm:py-5 sm:pr-14">
        <div
          className="
            flex h-10 w-10 shrink-0 items-center justify-center
            rounded-xl bg-teal-700 text-white shadow-sm
            sm:h-11 sm:w-11
          "
        >
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <h2
            id="welcome-title"
            className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg"
          >
            Welcome to your Secretariat workspace
          </h2>

          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
            Keep the current position, communications, references, deadlines,
            tasks and drafting context together for every issue.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canEdit && (
              <Link
                to="/issues/new"
                className="
                  inline-flex min-h-10 items-center justify-center gap-2
                  rounded-lg bg-teal-700 px-4 py-2
                  text-sm font-semibold text-white shadow-sm
                  transition-colors
                  hover:bg-teal-800
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-teal-600
                  focus-visible:ring-offset-2
                "
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                <span>Create an issue</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}

            <Link
              to="/help"
              className="
                inline-flex min-h-10 items-center justify-center gap-2
                rounded-lg border border-teal-200 bg-white px-4 py-2
                text-sm font-semibold text-teal-900 shadow-sm
                transition-colors
                hover:border-teal-300 hover:bg-teal-50
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-teal-600
                focus-visible:ring-offset-2
              "
            >
              <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
              <span>View quick guide</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
