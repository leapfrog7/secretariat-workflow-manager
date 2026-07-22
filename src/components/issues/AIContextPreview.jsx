import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Check, CheckCheck, Clipboard, History, LoaderCircle, MessageSquareText, Save, ShieldCheck, Sparkles, Square, X } from 'lucide-react';
import { buildAIContext } from '../../utils/aiContextUtils';
import { formatDisplayDate } from '../../utils/dateUtils';
import { getSettings } from '../../db/database';
import { COMMUNICATION_TYPES, generateLocalDraft, normalizeLocalAISettings } from '../../services/lmStudioClient';
import { normalizeOfficeProfile, RECIPIENT_RELATIONSHIPS } from '../../utils/governmentDraftUtils';
import { getDraftsByIssue, saveDraft } from '../../db/draftRepository';

const RECIPIENT_REQUIRED_TYPES = new Set(['Letter', 'D.O. Letter', 'Office Memorandum', 'Inter-Departmental Note', 'Notification', 'Press Communique / Note', 'Endorsement']);

export default function AIContextPreview({ issue, assignedOfficer, officers, summary, communications, references }) {
  const [sourceTab, setSourceTab] = useState('Communications');
  const [selectedCommunicationIds, setSelectedCommunicationIds] = useState([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState([]);
  const [options, setOptions] = useState({ issueDetails: true, currentPosition: true, summary: true });
  const [copyStatus, setCopyStatus] = useState('idle');
  const [aiSettings, setAISettings] = useState(null);
  const [officeProfile, setOfficeProfile] = useState(null);
  const [communicationType, setCommunicationType] = useState(COMMUNICATION_TYPES[0]);
  const [signatoryId, setSignatoryId] = useState('');
  const [recipient, setRecipient] = useState({ name: '', designation: '', organization: '', address: '' });
  const [recipientRelationship, setRecipientRelationship] = useState(RECIPIENT_RELATIONSHIPS[0]);
  const [documentDetails, setDocumentDetails] = useState({ subject: issue.shortTitle || '', fileNumber: issue.eFileNumber || '', issueDate: '', salutation: '', copyTo: '' });
  const [useDetailedContext, setUseDetailedContext] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [generation, setGeneration] = useState({ status: 'idle', text: '', error: '', model: '', stats: {}, draftId: '' });
  const [draftCopyStatus, setDraftCopyStatus] = useState('idle');
  const [draftSaveStatus, setDraftSaveStatus] = useState('idle');
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const generationController = useRef(null);

  useEffect(() => {
    setSelectedCommunicationIds([]);
    setSelectedReferenceIds([]);
    setOptions({ issueDetails: true, currentPosition: true, summary: true });
    setCopyStatus('idle');
    setGeneration({ status: 'idle', text: '', error: '', model: '', stats: {}, draftId: '' });
    setDraftCopyStatus('idle');
    setDraftSaveStatus('idle');
    setSelectedDraftId('');
    setRecipient({ name: '', designation: '', organization: '', address: '' });
    setRecipientRelationship(RECIPIENT_RELATIONSHIPS[0]);
    setDocumentDetails({ subject: issue.shortTitle || '', fileNumber: issue.eFileNumber || '', issueDate: '', salutation: '', copyTo: '' });
    setUseDetailedContext(false);
  }, [issue.id]);

  useEffect(() => {
    let active = true;
    const loadDrafts = () => getDraftsByIssue(issue.id).then((items) => {
      if (active) setDrafts(items);
    });
    loadDrafts();
    window.addEventListener('swm:workspace-synced', loadDrafts);
    return () => {
      active = false;
      window.removeEventListener('swm:workspace-synced', loadDrafts);
    };
  }, [issue.id]);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active) {
          const profile = normalizeOfficeProfile(settings.officeProfile);
          setAISettings(normalizeLocalAISettings(settings.localAI));
          setOfficeProfile(profile);
          const firstAuthorized = officers.find((officer) => officer.isActive && profile.authorizedSignatoryIds.includes(officer.id));
          setSignatoryId((current) => current || firstAuthorized?.id || '');
        }
      })
      .catch((error) => {
        if (active) setGeneration({ status: 'error', text: '', error: error.message || 'Unable to load drafting settings.', model: '', stats: {} });
      });
    return () => {
      active = false;
      generationController.current?.abort();
    };
  }, [officers]);

  const authorizedSignatories = useMemo(() => {
    if (!officeProfile) return [];
    return officers.filter((officer) => officer.isActive && officeProfile.authorizedSignatoryIds.includes(officer.id));
  }, [officers, officeProfile]);
  const signatory = authorizedSignatories.find((officer) => officer.id === signatoryId);

  const selectedCommunications = useMemo(() => communications.filter((item) => selectedCommunicationIds.includes(item.id)), [communications, selectedCommunicationIds]);
  const selectedReferences = useMemo(() => references.filter((item) => selectedReferenceIds.includes(item.id)), [references, selectedReferenceIds]);
  const context = useMemo(() => buildAIContext({
    issue,
    assignedOfficer,
    summary,
    communications: selectedCommunications,
    references: selectedReferences,
    includeIssueDetails: options.issueDetails,
    includeCurrentPosition: options.currentPosition,
    includeSummary: options.summary,
  }), [issue, assignedOfficer, summary, selectedCommunications, selectedReferences, options]);

  useEffect(() => {
    if (generation.status === 'generating') generationController.current?.abort();
  }, [context.text, communicationType, signatoryId, recipient, recipientRelationship, documentDetails, useDetailedContext, instruction]);

  const updateRecipient = (field, value) => setRecipient((current) => ({ ...current, [field]: value }));
  const updateDocumentDetails = (field, value) => setDocumentDetails((current) => ({ ...current, [field]: value }));

  const toggleId = (setter, id) => setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const copyContext = async () => {
    try {
      await copyText(context.text);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    window.setTimeout(() => setCopyStatus('idle'), 1400);
  };

  const generateDraft = async () => {
    if (!aiSettings || !officeProfile) {
      setGeneration({ status: 'error', text: '', error: 'Drafting settings are still loading. Please try again.', model: '', stats: {} });
      return;
    }
    if (!signatory) {
      setGeneration({ status: 'error', text: '', error: authorizedSignatories.length ? 'Select an authorized signatory.' : 'Choose at least one authorized signatory in Settings before generating a draft.', model: '', stats: {} });
      return;
    }
    if (!officeProfile.ministry.trim() && !officeProfile.department.trim()) {
      setGeneration({ status: 'error', text: '', error: 'Add the issuing Ministry or Department in Settings before generating official communication.', model: '', stats: {} });
      return;
    }
    if (RECIPIENT_REQUIRED_TYPES.has(communicationType) && !recipient.organization.trim() && !recipient.name.trim()) {
      setGeneration({ status: 'error', text: '', error: 'Enter the recipient organization or addressee so the model knows who the Ministry is writing to.', model: '', stats: {} });
      return;
    }
    if (!instruction.trim()) {
      setGeneration({ status: 'error', text: '', error: 'Enter the purpose or requested action. A precise drafting brief keeps the local model from guessing.', model: '', stats: {} });
      return;
    }
    if (!context.text) {
      setGeneration({ status: 'error', text: '', error: 'Select some Issue context before generating a draft.', model: '', stats: {} });
      return;
    }
    const controller = new AbortController();
    generationController.current = controller;
    setGeneration({ status: 'generating', text: '', error: '', model: '', stats: {}, draftId: '' });
    setDraftSaveStatus('idle');
    try {
      const result = await generateLocalDraft({
        settings: aiSettings,
        context: useDetailedContext ? context.text : `Issue subject: ${documentDetails.subject || issue.shortTitle}`,
        communicationType,
        officeProfile,
        signatory,
        recipient,
        recipientRelationship,
        draftMode: useDetailedContext ? 'detailed' : 'conservative',
        documentDetails,
        instruction,
        signal: controller.signal,
      });
      const saved = await saveDraft({
        issueId: issue.id,
        communicationType,
        signatoryId: signatory.id,
        signatoryName: signatory.name,
        recipientRelationship,
        recipient,
        documentDetails,
        instruction,
        content: result.text,
        model: result.model,
        selectedCommunicationIds,
        selectedReferenceIds,
      });
      setGeneration({ status: 'complete', text: result.text, error: '', model: result.model, stats: result.stats, draftId: saved.id });
      setDrafts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedDraftId(saved.id);
      setDraftSaveStatus('saved');
    } catch (error) {
      if (error.name === 'AbortError') setGeneration({ status: 'idle', text: '', error: '', model: '', stats: {}, draftId: '' });
      else setGeneration({ status: 'error', text: '', error: error.message || 'Unable to generate or save the local draft.', model: '', stats: {}, draftId: '' });
    } finally {
      generationController.current = null;
    }
  };

  const copyDraft = async () => {
    try {
      await copyText(generation.text);
      setDraftCopyStatus('copied');
    } catch {
      setDraftCopyStatus('error');
    }
    window.setTimeout(() => setDraftCopyStatus('idle'), 1400);
  };

  const saveDraftChanges = async () => {
    try {
      setDraftSaveStatus('saving');
      const saved = await saveDraft({
        id: generation.draftId || undefined,
        issueId: issue.id,
        communicationType,
        signatoryId: signatory?.id || '',
        signatoryName: signatory?.name || '',
        recipientRelationship,
        recipient,
        documentDetails,
        instruction,
        content: generation.text,
        model: generation.model,
        selectedCommunicationIds,
        selectedReferenceIds,
      });
      setGeneration((current) => ({ ...current, draftId: saved.id }));
      setDrafts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedDraftId(saved.id);
      setDraftSaveStatus('saved');
      window.setTimeout(() => setDraftSaveStatus('idle'), 1400);
    } catch (error) {
      setDraftSaveStatus('error');
      setGeneration((current) => ({ ...current, error: error.validationErrors?.content || error.message || 'Unable to save draft.' }));
    }
  };

  const loadSavedDraft = (draftId) => {
    setSelectedDraftId(draftId);
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return;
    setCommunicationType(draft.communicationType || COMMUNICATION_TYPES[0]);
    setSignatoryId(draft.signatoryId || '');
    setRecipient(draft.recipient || { name: '', designation: '', organization: '', address: '' });
    setRecipientRelationship(draft.recipientRelationship || RECIPIENT_RELATIONSHIPS[0]);
    setDocumentDetails(draft.documentDetails || { subject: issue.shortTitle || '', fileNumber: issue.eFileNumber || '', issueDate: '', salutation: '', copyTo: '' });
    setInstruction(draft.instruction || '');
    setSelectedCommunicationIds(draft.selectedCommunicationIds || []);
    setSelectedReferenceIds(draft.selectedReferenceIds || []);
    setGeneration({ status: 'complete', text: draft.content, error: '', model: draft.model, stats: {}, draftId: draft.id });
    setDraftSaveStatus('idle');
  };

  return (
    <section className="surface overflow-hidden rounded-md">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dce6e4] px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-700" /><h2 className="text-base font-semibold text-[#17333b]">AI context preview</h2></div>
          <p className="mt-1 text-sm text-slate-600">Review the exact Issue context before using it for drafting.</p>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">Local preview only</div>
      </div>

      <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b border-[#dce6e4] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#e3ebe9] px-4 py-4">
            <h3 className="text-sm font-semibold text-slate-800">Core context</h3>
            <div className="mt-3 space-y-2">
              <Option label="Issue details" checked={options.issueDetails} onChange={(checked) => setOptions((current) => ({ ...current, issueDetails: checked }))} />
              <Option label="Current position" checked={options.currentPosition} disabled={!issue.currentPosition} onChange={(checked) => setOptions((current) => ({ ...current, currentPosition: checked }))} />
              <Option label="Latest running summary" checked={options.summary} disabled={!summary} onChange={(checked) => setOptions((current) => ({ ...current, summary: checked }))} />
            </div>
          </div>

          <div className="flex border-b border-[#e3ebe9] bg-slate-50 p-1" role="tablist" aria-label="Context sources">
            {['Communications', 'References'].map((tab) => (
              <button key={tab} type="button" role="tab" aria-selected={sourceTab === tab} onClick={() => setSourceTab(tab)} className={`flex-1 rounded px-2 py-2 text-xs font-semibold ${sourceTab === tab ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{tab} <span className="tabular-nums">({tab === 'Communications' ? communications.length : references.length})</span></button>
            ))}
          </div>

          {sourceTab === 'Communications' ? (
            <SourceSelector
              items={communications}
              selectedIds={selectedCommunicationIds}
              onToggle={(id) => toggleId(setSelectedCommunicationIds, id)}
              onSelectAll={() => setSelectedCommunicationIds(communications.map((item) => item.id))}
              onClear={() => setSelectedCommunicationIds([])}
              emptyText="No communications recorded."
              renderItem={(item) => <CommunicationLabel communication={item} />}
            />
          ) : (
            <SourceSelector
              items={references}
              selectedIds={selectedReferenceIds}
              onToggle={(id) => toggleId(setSelectedReferenceIds, id)}
              onSelectAll={() => setSelectedReferenceIds(references.map((item) => item.id))}
              onClear={() => setSelectedReferenceIds([])}
              emptyText="No references recorded."
              renderItem={(item) => <ReferenceLabel reference={item} />}
            />
          )}
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3ebe9] bg-slate-50 px-4 py-3 sm:px-5">
            <div className="text-xs text-slate-500"><span className="font-semibold tabular-nums text-slate-700">{context.wordCount}</span> words <span className="mx-1 text-slate-300">|</span> <span className="font-semibold tabular-nums text-slate-700">{context.selectedSourceCount}</span> selected sources</div>
            <button type="button" onClick={copyContext} disabled={!context.text} className={`inline-flex h-9 min-w-32 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-white disabled:bg-slate-300 ${copyStatus === 'copied' ? 'bg-emerald-700' : copyStatus === 'error' ? 'bg-red-700' : 'bg-teal-700 hover:bg-teal-800'}`}>
              {copyStatus === 'copied' ? <Check className="h-4 w-4" /> : copyStatus === 'error' ? <X className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy context'}
            </button>
          </div>
          <pre className="min-h-[520px] whitespace-pre-wrap break-words px-4 py-5 font-sans text-sm leading-6 text-slate-700 sm:px-6">{context.text || 'Select at least one context section or source.'}</pre>
        </div>
      </div>

      <div className="border-t border-[#dce6e4]">
        <div className="flex flex-wrap items-start justify-between gap-3 bg-[#f7faf9] px-4 py-4 sm:px-5">
          <div>
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-cyan-700" /><h3 className="text-sm font-semibold text-[#17333b]">Generate with local model</h3></div>
            <p className="mt-1 text-xs text-slate-500">Selected context is sent only to LM Studio. A successful generated draft is saved to the workspace.</p>
          </div>
          <Link to="/settings" className="text-xs font-semibold text-teal-700 hover:underline">Drafting and Local AI settings</Link>
        </div>
        {drafts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-[#e3ebe9] bg-white px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><History className="h-4 w-4 text-cyan-700" />Saved drafts</div>
            <select aria-label="Saved drafts" value={selectedDraftId} onChange={(event) => loadSavedDraft(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700 sm:max-w-md">
              <option value="">Select a draft</option>
              {drafts.map((draft) => <option key={draft.id} value={draft.id}>Version {draft.version} - {draft.communicationType || 'Communication'} - {new Date(draft.updatedAt || draft.createdAt).toLocaleString()}</option>)}
            </select>
          </div>
        )}
        <div className="grid gap-3 border-t border-[#e3ebe9] px-4 py-4 sm:grid-cols-2 sm:px-5">
          <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Communication type</span><select value={communicationType} onChange={(event) => setCommunicationType(event.target.value)} disabled={generation.status === 'generating'} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100">{COMMUNICATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Authorized signatory</span><select value={signatoryId} onChange={(event) => setSignatoryId(event.target.value)} disabled={generation.status === 'generating' || !authorizedSignatories.length} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100"><option value="">Select signatory</option>{authorizedSignatories.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}{officer.designation ? ` - ${officer.designation}` : ''}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Recipient relationship</span><select value={recipientRelationship} onChange={(event) => setRecipientRelationship(event.target.value)} disabled={generation.status === 'generating'} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100">{RECIPIENT_RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Recipient organization {RECIPIENT_REQUIRED_TYPES.has(communicationType) && <span className="text-red-700">*</span>}</span><input value={recipient.organization} onChange={(event) => updateRecipient('organization', event.target.value)} disabled={generation.status === 'generating'} placeholder="Example: Department of Legal Affairs" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100" /></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-medium text-slate-700">Purpose / requested action <span className="text-red-700">*</span></span><textarea rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)} disabled={generation.status === 'generating'} placeholder="Example: Request comments on the proposed scheme by 31 July 2026, referring to eReceipt 12345." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900 disabled:bg-slate-100" /><span className="mt-1 block text-xs text-slate-500">State who should do what, and by when. This is the model's primary drafting brief.</span></label>
          <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={useDetailedContext} onChange={(event) => setUseDetailedContext(event.target.checked)} disabled={generation.status === 'generating'} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-700" /><span><span className="block font-medium">Use selected Issue context in the body</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Leave off for a concise purpose-led draft. Enable when the communication must draw facts from the running summary, communications, or references selected above.</span></span></label>
          <details className="rounded-md border border-slate-200 bg-slate-50 sm:col-span-2">
            <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-slate-700">Document and addressee details <span className="font-normal text-slate-500">(optional)</span></summary>
            <div className="grid gap-3 border-t border-slate-200 px-3 py-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><DraftInput label="Communication subject" value={documentDetails.subject} onChange={(value) => updateDocumentDetails('subject', value)} /></div>
              <DraftInput label="Communication number" value={documentDetails.fileNumber} onChange={(value) => updateDocumentDetails('fileNumber', value)} />
              <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Communication date</span><input type="date" value={documentDetails.issueDate} onChange={(event) => updateDocumentDetails('issueDate', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" /></label>
              <DraftInput label="Addressee name" value={recipient.name} onChange={(value) => updateRecipient('name', value)} />
              <DraftInput label="Addressee designation" value={recipient.designation} onChange={(value) => updateRecipient('designation', value)} />
              <DraftInput label="Salutation" value={documentDetails.salutation} onChange={(value) => updateDocumentDetails('salutation', value)} placeholder="Example: Dear Shri Sharma" />
              <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Recipient address</span><textarea rows={3} value={recipient.address} onChange={(event) => updateRecipient('address', event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900" /></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-medium text-slate-700">Copy / endorsement recipients <span className="font-normal text-slate-500">(one per line)</span></span><textarea rows={3} value={documentDetails.copyTo} onChange={(event) => updateDocumentDetails('copyTo', event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900" /></label>
            </div>
          </details>
          {!authorizedSignatories.length && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2">Choose authorized signatories in <Link to="/settings" className="font-semibold underline">Settings</Link> before generating official communication.</div>}
          {authorizedSignatories.length > 0 && !signatory && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2">Select the officer who will sign this communication.</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
            <span className="text-xs text-slate-500">Model: <span className="font-semibold text-slate-700">{aiSettings?.model || 'Loading settings...'}</span></span>
            {generation.status === 'generating' ? (
              <button type="button" onClick={() => generationController.current?.abort()} className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 hover:bg-red-100"><Square className="h-4 w-4" />Stop generation</button>
            ) : (
              <button type="button" onClick={generateDraft} className="inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"><Sparkles className="h-4 w-4" />Generate draft</button>
            )}
          </div>
        </div>

        {generation.status === 'generating' && <div className="flex min-h-36 items-center justify-center gap-3 border-t border-[#e3ebe9] px-4 py-8 text-sm font-medium text-slate-600"><LoaderCircle className="h-5 w-5 animate-spin text-cyan-700" />Generating locally. The first request may include model loading time.</div>}
        {generation.status === 'error' && <div className="border-t border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 sm:px-5">{generation.error}</div>}
        {generation.status === 'complete' && (
          <div className="border-t border-[#e3ebe9] px-4 py-4 sm:px-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-[#17333b]">Generated draft</h3><p className="mt-1 text-xs text-slate-500">{generation.model}{generation.stats.tokens_per_second ? ` - ${generation.stats.tokens_per_second.toFixed(1)} tokens/second` : ''}</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={saveDraftChanges} disabled={!generation.text.trim() || draftSaveStatus === 'saving'} className={`inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-white disabled:bg-slate-300 ${draftSaveStatus === 'saved' ? 'bg-emerald-700' : draftSaveStatus === 'error' ? 'bg-red-700' : 'bg-cyan-700 hover:bg-cyan-800'}`}><Save className="h-4 w-4" />{draftSaveStatus === 'saving' ? 'Saving...' : draftSaveStatus === 'saved' ? 'Saved' : draftSaveStatus === 'error' ? 'Save failed' : 'Save changes'}</button>
                <button type="button" onClick={copyDraft} className={`inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-white ${draftCopyStatus === 'copied' ? 'bg-emerald-700' : draftCopyStatus === 'error' ? 'bg-red-700' : 'bg-teal-700 hover:bg-teal-800'}`}>{draftCopyStatus === 'copied' ? <Check className="h-4 w-4" /> : draftCopyStatus === 'error' ? <X className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{draftCopyStatus === 'copied' ? 'Copied' : draftCopyStatus === 'error' ? 'Copy failed' : 'Copy draft'}</button>
              </div>
            </div>
            <textarea value={generation.text} onChange={(event) => { setGeneration((current) => ({ ...current, text: event.target.value })); setDraftSaveStatus('dirty'); }} rows={28} aria-label="Editable generated draft" className="w-full resize-y rounded-md border border-slate-300 bg-white px-5 py-5 font-serif text-sm leading-7 text-slate-900 shadow-inner" />
            <p className="mt-2 text-xs text-slate-500">New generations are saved automatically. Save changes after editing this copy.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function DraftInput({ label, value, onChange, placeholder = '' }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" /></label>;
}

function Option({ label, checked, disabled = false, onChange }) {
  return <label className={`flex items-center gap-2 text-sm ${disabled ? 'text-slate-400' : 'text-slate-700'}`}><input type="checkbox" checked={!disabled && checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-teal-700" /><span>{label}</span></label>;
}

function SourceSelector({ items, selectedIds, onToggle, onSelectAll, onClear, emptyText, renderItem }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-[#e3ebe9] px-4 py-2.5">
        <span className="text-xs font-semibold text-slate-600">{selectedIds.length} selected</span>
        <div className="flex gap-1">
          <button type="button" onClick={onSelectAll} disabled={!items.length} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:text-slate-300"><CheckCheck className="h-3.5 w-3.5" />All</button>
          <button type="button" onClick={onClear} disabled={!selectedIds.length} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:text-slate-300"><X className="h-3.5 w-3.5" />Clear</button>
        </div>
      </div>
      {items.length ? <div className="max-h-[430px] divide-y divide-[#e3ebe9] overflow-y-auto">{items.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-[#f5faf8]"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-teal-700" /><span className="min-w-0">{renderItem(item)}</span></label>)}</div> : <p className="px-4 py-8 text-center text-sm text-slate-500">{emptyText}</p>}
    </div>
  );
}

function CommunicationLabel({ communication }) {
  return <><span className="flex items-center gap-1.5 text-xs font-semibold text-[#174f5b]"><MessageSquareText className="h-3.5 w-3.5" />{formatDisplayDate(communication.communicationDate)} - {communication.communicationType}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600">{communication.eReceiptNumber ? `eReceipt ${communication.eReceiptNumber} - ` : ''}{communication.sourceSubject || communication.details}</span></>;
}

function ReferenceLabel({ reference }) {
  return <><span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800"><BookOpen className="h-3.5 w-3.5" />{reference.referenceDate ? formatDisplayDate(reference.referenceDate) : 'Undated reference'}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600">{reference.citation}</span></>;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}
