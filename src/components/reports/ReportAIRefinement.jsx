import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import { getSettings } from '../../db/database';
import { DEFAULT_AI_PREFERENCES } from '../../constants/issueConstants';
import { normalizeLocalAISettings, refineLocalReport } from '../../services/lmStudioClient';
import { refineCloudReport } from '../../services/cloudAIClient';
import { useAuth } from '../../features/auth/AuthContext';
import AIModeControl from '../ai/AIModeControl';
import GeminiTaskLevelControl from '../ai/GeminiTaskLevelControl';
import ConfirmDialog from '../common/ConfirmDialog';

export default function ReportAIRefinement({ report, refinement, onComplete, onDiscard }) {
  const auth = useAuth();
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [cloudConsent, setCloudConsent] = useState(false);
  const controllerRef = useRef(null);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (!active) return;
        setConfig({
          local: normalizeLocalAISettings(settings.localAI),
          preferences: { ...DEFAULT_AI_PREFERENCES, ...(settings.aiPreferences || {}) },
        });
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load AI settings.');
      });
    return () => {
      active = false;
      controllerRef.current?.abort();
    };
  }, []);

  const issueCount = report?.kind === 'activity' ? report.issues.length : report?.rows.length || 0;
  const changeMode = (mode) => {
    controllerRef.current?.abort();
    setConfig((current) => current ? { ...current, preferences: { ...current.preferences, mode } } : current);
    setStatus('idle');
    setError('');
  };
  const changeTaskLevel = (geminiTaskLevel) => {
    setConfig((current) => current ? { ...current, preferences: { ...current.preferences, geminiTaskLevel } } : current);
  };

  const generate = async (cloudConfirmed = false) => {
    if (!config) {
      setError('AI settings are still loading. Please try again.');
      return;
    }
    if (!issueCount) {
      setError('Include at least one Issue before using AI.');
      return;
    }
    if (config.preferences.mode === 'cloud' && !cloudConfirmed) {
      if (!auth.workspace?.id) {
        setError('Sign in to an active workspace before using Cloud AI.');
        return;
      }
      setCloudConsent(true);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('generating');
    setError('');
    try {
      const generator = config.preferences.mode === 'cloud' ? refineCloudReport : refineLocalReport;
      const result = await generator({
        ...(config.preferences.mode === 'cloud'
          ? {
              workspaceId: auth.workspace.id,
              provider: config.preferences.cloudProvider,
              taskLevel: config.preferences.geminiTaskLevel,
            }
          : { settings: config.local }),
        report,
        signal: controller.signal,
      });
      setStatus('complete');
      onComplete({ ...result, mode: config.preferences.mode, provider: config.preferences.cloudProvider });
    } catch (generationError) {
      if (generationError.name !== 'AbortError') {
        setStatus('idle');
        setError(generationError.message || 'AI could not improve this report.');
      }
    }
  };

  const providerLabel = config?.preferences.cloudProvider === 'openai' ? 'OpenAI' : 'Gemini';

  return (
    <>
      <section className="report-controls surface mb-4 overflow-hidden rounded-md border border-cyan-100">
        <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#17333b]"><Sparkles className="h-4 w-4 text-cyan-700" />Optional AI refinement</div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">AI reorganises and tightens the generated report. The factual source report remains available and should be used for verification.</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <AIModeControl value={config?.preferences.mode || 'local'} onChange={changeMode} cloudDisabled={!auth.workspace?.id} disabled={status === 'generating'} compact />
            <button type="button" onClick={() => generate()} disabled={status === 'generating' || !config || !issueCount} className="inline-flex h-10 min-w-40 items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:cursor-wait disabled:bg-slate-400">
              {status === 'generating' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {status === 'generating' ? 'Improving report...' : refinement ? 'Regenerate' : 'Improve with AI'}
            </button>
          </div>
        </div>

        {config?.preferences.mode === 'cloud' && config.preferences.cloudProvider === 'gemini' && (
          <div className="border-t border-cyan-100 bg-cyan-50/40 px-3 py-3 sm:px-4">
            <GeminiTaskLevelControl value={config.preferences.geminiTaskLevel} onChange={changeTaskLevel} disabled={status === 'generating'} label="Report complexity" />
          </div>
        )}

        {status === 'generating' && <div className="flex items-center gap-3 border-t border-cyan-100 bg-white px-3 py-3 text-xs font-medium text-slate-600 sm:px-4" role="status"><LoaderCircle className="h-4 w-4 animate-spin text-cyan-700" />The source report is unchanged while {config.preferences.mode === 'cloud' ? providerLabel : 'the local model'} prepares a refined version.</div>}
        {refinement && status !== 'generating' && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 sm:px-4">
            <span><strong>AI version ready.</strong> Generated using {refinement.model}. Review it against the source report.</span>
            <button type="button" onClick={() => { onDiscard(); setStatus('idle'); }} className="inline-flex h-8 items-center gap-1.5 rounded px-2 font-semibold text-emerald-900 hover:bg-emerald-100"><RotateCcw className="h-3.5 w-3.5" />Discard AI version</button>
          </div>
        )}
        {refinement?.warnings?.length > 0 && status !== 'generating' && <div className="border-t border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 sm:px-4">{refinement.warnings.map((warning) => <div key={warning} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{warning}</div>)}</div>}
        {error && <div className="border-t border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800 sm:px-4">{error}</div>}
      </section>

      <ConfirmDialog
        open={cloudConsent}
        title={`Send report context to ${providerLabel}?`}
        message={`The selected source report for ${issueCount} Issue${issueCount === 1 ? '' : 's'} will be sent to ${providerLabel} for refinement. Usage and status are logged, but the prompt and generated report text are not stored in the AI log.`}
        confirmLabel="Send and improve"
        onCancel={() => setCloudConsent(false)}
        onConfirm={() => {
          setCloudConsent(false);
          generate(true);
        }}
      />
    </>
  );
}
