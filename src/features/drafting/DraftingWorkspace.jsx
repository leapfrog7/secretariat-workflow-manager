import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Check, CheckCheck, Clipboard, Download, FileOutput, FilePenLine, GitBranch, History, LoaderCircle, MessageSquareText, MoreHorizontal, RotateCcw, Save, Settings2, ShieldCheck, Sparkles, Square, X } from 'lucide-react';
import { buildAIContext } from '../../utils/aiContextUtils';
import { formatDisplayDate, todayISO } from '../../utils/dateUtils';
import { getSettings } from '../../db/database';
import { COMMUNICATION_TYPES, normalizeLocalAISettings } from '../../services/lmStudioClient';
import { normalizeOfficeProfile, RECIPIENT_RELATIONSHIPS } from '../../utils/governmentDraftUtils';
import { getDraftsByIssue, MAX_DRAFTS_PER_ISSUE, saveDraft, saveDraftSnapshot } from '../../db/draftRepository';
import { DEFAULT_AI_PREFERENCES } from '../../constants/issueConstants';
import { useAuth } from '../auth/AuthContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import GeminiTaskLevelControl from '../../components/ai/GeminiTaskLevelControl';
import { getGeminiTaskLevel } from '../../../shared/cloudAIModels';
import AIModeControl from '../../components/ai/AIModeControl';
import AdaptiveSelect from '../../components/common/AdaptiveSelect';
import {
  changeDraftDocumentTemplate,
  createDraftDocument,
  legacyDraftToDocument,
  renderDraftClipboardText,
  renderStructuredDraft,
  replaceDraftBodyRichText,
  validateDraftDocument,
} from './domain/draftDocument';
import ParagraphBankPanel from './paragraphBank/ParagraphBankPanel';
import { getParagraphBankEntries } from './paragraphBank/paragraphBankRepository';
import { createDraftAIProvider } from './ai/draftAIProviders';
import { buildDraftAIRequest, generateDraftBody, insertDraftBodyText, regenerateDraftBodySelection } from './ai/draftAIOrchestrator';
import {
  createGeneratedWorkingCopy,
  createSavedWorkingCopy,
  EMPTY_DRAFT_WORKING_COPY,
  hasUnsavedWorkingCopy,
  markWorkingCopyChanged,
} from './domain/draftWorkingCopy';

const DraftDocumentEditor = lazy(() => import('./editor/DraftDocumentEditor'));

export default function DraftingWorkspace({ issue, assignedOfficer, officers, summary, communications, references, notes = [], initialNoteIds = [], initialCommunicationIds = [], initialReferenceIds = [], sourceNoteId = '', noteSelectionRevision = 0, readOnly = false, onSaveCommunication }) {
  const auth = useAuth();
  const [sourceTab, setSourceTab] = useState('Communications');
  const [workspaceView, setWorkspaceView] = useState('compose');
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftDialogTab, setDraftDialogTab] = useState('details');
  const [draftDialogType, setDraftDialogType] = useState(COMMUNICATION_TYPES[0]);
  const [selectedCommunicationIds, setSelectedCommunicationIds] = useState([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [options, setOptions] = useState({ issueDetails: true, currentPosition: true, summary: true });
  const [copyStatus, setCopyStatus] = useState('idle');
  const [aiSettings, setAISettings] = useState(null);
  const [aiPreferences, setAIPreferences] = useState(DEFAULT_AI_PREFERENCES);
  const [officeProfile, setOfficeProfile] = useState(null);
  const [communicationType, setCommunicationType] = useState(COMMUNICATION_TYPES[0]);
  const [signatoryId, setSignatoryId] = useState('');
  const [recipient, setRecipient] = useState({ name: '', designation: '', organization: '', address: '' });
  const [recipientRelationship, setRecipientRelationship] = useState(RECIPIENT_RELATIONSHIPS[0]);
  const [documentDetails, setDocumentDetails] = useState({ subject: issue.shortTitle || '', fileNumber: issue.eFileNumber || '', issueDate: todayISO(), salutation: '', copyTo: '' });
  const [useDetailedContext, setUseDetailedContext] = useState(true);
  const [instruction, setInstruction] = useState('');
  const [additionalInstruction, setAdditionalInstruction] = useState('');
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [generation, setGeneration] = useState({ status: 'idle', text: '', error: '', model: '', stats: {}, draftId: '' });
  const [draftCopyStatus, setDraftCopyStatus] = useState('idle');
  const [draftExportStatus, setDraftExportStatus] = useState('idle');
  const [draftSaveStatus, setDraftSaveStatus] = useState('idle');
  const [drafts, setDrafts] = useState([]);
  const [paragraphBank, setParagraphBank] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [paragraphStatus, setParagraphStatus] = useState({ status: 'idle', error: '' });
  const [recordStatus, setRecordStatus] = useState('idle');
  const [cloudConsent, setCloudConsent] = useState('');
  const [workingCopy, setWorkingCopy] = useState(EMPTY_DRAFT_WORKING_COPY);
  const [pendingWorkingAction, setPendingWorkingAction] = useState(null);
  const generationController = useRef(null);
  const draftTextareaRef = useRef(null);
  const draftDialogRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const pendingRegenerationSelection = useRef(null);

  const rememberSelection = (nextSelection) => {
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
  };

  const openAIPreparation = (tab = 'details') => {
    setDraftDialogType(communicationType);
    setDraftDialogTab(tab);
    setDraftDialogOpen(true);
  };

  useEffect(() => {
    setSelectedCommunicationIds([]);
    setSelectedReferenceIds([]);
    setSelectedNoteIds([]);
    setOptions({ issueDetails: true, currentPosition: true, summary: true });
    setCopyStatus('idle');
    setGeneration({ status: 'idle', text: '', error: '', model: '', stats: {}, draftId: '' });
    setDraftCopyStatus('idle');
    setDraftExportStatus('idle');
    setDraftSaveStatus('idle');
    setSelectedDraftId('');
    rememberSelection({ start: 0, end: 0 });
    setParagraphStatus({ status: 'idle', error: '' });
    setRecordStatus('idle');
    setWorkingCopy(EMPTY_DRAFT_WORKING_COPY);
    setPendingWorkingAction(null);
    setRecipient({ name: '', designation: '', organization: '', address: '' });
    setRecipientRelationship(RECIPIENT_RELATIONSHIPS[0]);
    setDocumentDetails({ subject: issue.shortTitle || '', fileNumber: issue.eFileNumber || '', issueDate: todayISO(), salutation: '', copyTo: '' });
    setUseDetailedContext(true);
    setInstruction('');
    setAdditionalInstruction('');
    setAdvancedSettingsOpen(false);
    setWorkspaceView('compose');
    setDraftDialogOpen(false);
    setDraftDialogTab('details');
    setDraftDialogType(COMMUNICATION_TYPES[0]);
  }, [issue.id]);

  useEffect(() => {
    if (!draftDialogOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const dialog = draftDialogRef.current;
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const initialFocus = window.requestAnimationFrame(() => dialog?.querySelector('[data-autofocus]')?.focus());
    const handleDialogKey = (event) => {
      if (event.key === 'Escape' && generation.status !== 'generating') setDraftDialogOpen(false);
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleDialogKey);
    return () => {
      window.cancelAnimationFrame(initialFocus);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleDialogKey);
    };
  }, [draftDialogOpen, generation.status]);

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
    if (!noteSelectionRevision) return;
    setSelectedNoteIds(initialNoteIds.filter((id) => notes.some((note) => note.id === id)));
    setSelectedCommunicationIds(initialCommunicationIds.filter((id) => communications.some((item) => item.id === id)));
    setSelectedReferenceIds(initialReferenceIds.filter((id) => references.some((item) => item.id === id)));
    setSourceTab('Notes');
    setWorkspaceView('compose');
  }, [noteSelectionRevision, initialNoteIds, initialCommunicationIds, initialReferenceIds, notes, communications, references]);

  useEffect(() => {
    if (!hasUnsavedWorkingCopy(workingCopy)) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [workingCopy]);

  useEffect(() => {
    let active = true;
    const loadParagraphBank = async () => {
      const entries = await getParagraphBankEntries();
      if (active) setParagraphBank(entries);
      return entries;
    };
    loadParagraphBank();
    window.addEventListener('swm:workspace-synced', loadParagraphBank);
    window.addEventListener('swm:paragraph-bank-synced', loadParagraphBank);
    return () => {
      active = false;
      window.removeEventListener('swm:workspace-synced', loadParagraphBank);
      window.removeEventListener('swm:paragraph-bank-synced', loadParagraphBank);
    };
  }, []);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active) {
          const profile = normalizeOfficeProfile(settings.officeProfile);
          setAISettings(normalizeLocalAISettings(settings.localAI));
          setAIPreferences({ ...DEFAULT_AI_PREFERENCES, ...(settings.aiPreferences || {}) });
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
  const selectedNotes = useMemo(() => notes.filter((item) => selectedNoteIds.includes(item.id)), [notes, selectedNoteIds]);
  const sourceNote = useMemo(
    () => notes.find((item) => item.id === sourceNoteId) || null,
    [notes, sourceNoteId],
  );
  const sourceNoteLinkedCount = sourceNote
    ? sourceNote.linkedCommunicationIds.length + sourceNote.linkedReferenceIds.length
    : 0;
  const context = useMemo(() => buildAIContext({
    issue,
    assignedOfficer,
    summary,
    communications: selectedCommunications,
    references: selectedReferences,
    notes: selectedNotes,
    includeIssueDetails: options.issueDetails,
    includeCurrentPosition: options.currentPosition,
    includeSummary: options.summary,
  }), [issue, assignedOfficer, summary, selectedCommunications, selectedReferences, selectedNotes, options]);
  const resolvedInstruction = instruction.trim() || `Prepare the ${draftDialogType} from the proposal and reasoning in the selected Note. Use other selected Issue material only for supporting facts and references. Do not invent missing addressee details, decisions or requested actions.`;
  const draftRequestPreview = useMemo(() => {
    const requestContext = useDetailedContext ? context.text : `Issue subject: ${documentDetails.subject || issue.shortTitle}`;
    const request = buildDraftAIRequest({
      context: requestContext,
      communicationType: draftDialogType,
      officeProfile: officeProfile || {},
      signatory: signatory || {},
      recipient,
      recipientRelationship,
      draftMode: useDetailedContext ? 'detailed' : 'conservative',
      instruction: resolvedInstruction,
      additionalInstruction,
    });
    const text = `PROTECTED DRAFTING RULES\n${request.instructions}\n\nREQUEST SENT TO AI\n${request.input}`;
    return {
      ...request,
      text,
      characters: text.length,
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
      estimatedTokens: Math.ceil(text.length / 4),
    };
  }, [additionalInstruction, context.text, documentDetails.subject, draftDialogType, issue.shortTitle, officeProfile, recipient, recipientRelationship, resolvedInstruction, signatory, useDetailedContext]);

  useEffect(() => {
    if (generation.status === 'generating') generationController.current?.abort();
  }, [context.text, communicationType, signatoryId, recipient, recipientRelationship, documentDetails, useDetailedContext, instruction, additionalInstruction]);

  const markDraftDirty = ({ configuration = false } = {}) => {
    if (workingCopy.mode === 'snapshot') return;
    if (generation.status === 'complete') setDraftSaveStatus('dirty');
    setWorkingCopy((current) => markWorkingCopyChanged(current, { configuration }));
    setRecordStatus('idle');
  };

  const updateStructuredDraft = (transform) => {
    if (generation.status !== 'complete' || !generation.document || generation.document.blocks?.some((block) => block.role === 'legacyDocument')) {
      return false;
    }
    try {
      const rendered = renderStructuredDraft(transform(generation.document));
      setGeneration((current) => ({
        ...current,
        text: rendered.text,
        document: rendered.document,
        draftId: '',
        error: '',
      }));
      setDraftSaveStatus('dirty');
      setWorkingCopy((current) => markWorkingCopyChanged(current));
      setRecordStatus('idle');
      return true;
    } catch (error) {
      setGeneration((current) => ({ ...current, error: error.message || 'Unable to update document details.' }));
      return false;
    }
  };

  const updateRecipient = (field, value) => {
    const nextRecipient = { ...recipient, [field]: value };
    setRecipient(nextRecipient);
    if (!updateStructuredDraft((document) => ({
      ...document,
      metadata: { ...document.metadata, recipient: nextRecipient },
    }))) {
      markDraftDirty({ configuration: true });
    }
  };

  const updateDocumentDetails = (field, value) => {
    const nextDetails = { ...documentDetails, [field]: value };
    setDocumentDetails(nextDetails);
    const metadataField = field === 'fileNumber' ? 'communicationNumber' : field;
    if (!updateStructuredDraft((document) => ({
      ...document,
      metadata: { ...document.metadata, [metadataField]: value },
    }))) {
      markDraftDirty({ configuration: true });
    }
  };

  const changeCommunicationType = (value) => {
    setCommunicationType(value);
    const updated = updateStructuredDraft((document) => changeDraftDocumentTemplate(document, value));
    if (!updated) {
      markDraftDirty({ configuration: true });
    }
    return updated;
  };

  const changeSignatory = (value) => {
    setSignatoryId(value);
    const selected = authorizedSignatories.find((officer) => officer.id === value);
    const signatoryMetadata = selected ? {
      id: selected.id,
      name: selected.name,
      designation: selected.designation || '',
      telephone: selected.telephone || '',
      email: selected.email || '',
    } : {};
    if (!updateStructuredDraft((document) => ({
      ...document,
      metadata: {
        ...document.metadata,
        signatoryId: value,
        signatory: signatoryMetadata,
      },
    }))) {
      markDraftDirty({ configuration: true });
    }
  };

  const toggleId = (setter, id) => setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const chooseDraftingNote = (noteId) => {
    if (!noteId) {
      setSelectedNoteIds([]);
      return;
    }
    const selected = notes.find((item) => item.id === noteId);
    setSelectedNoteIds([noteId]);
    setUseDetailedContext(true);
    if (selected) {
      setSelectedCommunicationIds((current) => [...new Set([
        ...current,
        ...selected.linkedCommunicationIds.filter((id) => communications.some((item) => item.id === id)),
      ])]);
      setSelectedReferenceIds((current) => [...new Set([
        ...current,
        ...selected.linkedReferenceIds.filter((id) => references.some((item) => item.id === id)),
      ])]);
    }
  };
  const copyContext = async () => {
    try {
      await copyText(context.text);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    window.setTimeout(() => setCopyStatus('idle'), 1400);
  };

  const showDraftPreparationError = (message) => {
    setGeneration((current) => ({
      ...current,
      status: current.status === 'error' ? 'idle' : current.status,
      error: message,
    }));
  };

  const generateDraft = async (cloudConfirmed = false, discardConfirmed = false, requestedType = communicationType) => {
    if (!discardConfirmed && hasUnsavedWorkingCopy(workingCopy)) {
      setPendingWorkingAction({ type: 'generate', cloudConfirmed, communicationType: requestedType });
      return;
    }
    if (!aiSettings || !officeProfile) {
      showDraftPreparationError('Drafting settings are still loading. Please try again.');
      return;
    }
    if (!signatory) {
      showDraftPreparationError(authorizedSignatories.length ? 'Select an authorized signatory.' : 'Choose at least one authorized signatory in Settings before generating a draft.');
      return;
    }
    if (!officeProfile.ministry.trim() && !officeProfile.department.trim()) {
      showDraftPreparationError('Add the issuing Ministry or Department in Settings before generating official communication.');
      return;
    }
    if (!context.text) {
      showDraftPreparationError('Select some Issue context before generating a draft.');
      return;
    }
    if (!selectedNotes.length && !instruction.trim()) {
      showDraftPreparationError('State the goal or requested outcome of the communication, or select a saved Note as its basis.');
      setDraftDialogOpen(true);
      setDraftDialogTab('details');
      return;
    }
    if (aiPreferences.mode === 'cloud' && !cloudConfirmed) {
      if (!auth.workspace?.id) {
        showDraftPreparationError('Sign in to an active workspace before using Cloud AI.');
        return;
      }
      setCloudConsent('draft');
      return;
    }
    const controller = new AbortController();
    const previousGeneration = generation;
    generationController.current = controller;
    setGeneration((current) => ({ ...current, status: 'generating', error: '' }));
    setWorkspaceView('compose');
    try {
      const provider = createDraftAIProvider(aiPreferences.mode === 'cloud'
        ? { mode: 'cloud', workspaceId: auth.workspace.id, issueId: issue.id, provider: aiPreferences.cloudProvider, taskLevel: aiPreferences.geminiTaskLevel }
        : { mode: 'local', settings: aiSettings });
      const result = await generateDraftBody({
        provider,
        context: useDetailedContext ? context.text : `Issue subject: ${documentDetails.subject || issue.shortTitle}`,
        communicationType: requestedType,
        officeProfile,
        signatory,
        recipient,
        recipientRelationship,
        draftMode: useDetailedContext ? 'detailed' : 'conservative',
        documentDetails,
        instruction: instruction.trim() || `Prepare the ${requestedType} from the proposal and reasoning in the selected Note. Use other selected Issue material only for supporting facts and references. Do not invent missing addressee details, decisions or requested actions.`,
        additionalInstruction,
        signal: controller.signal,
      });
      setGeneration({ status: 'complete', text: result.text, document: result.document, error: '', model: result.model, stats: result.stats, draftId: '' });
      setSelectedDraftId('');
      setDraftSaveStatus('unsaved');
      setWorkingCopy(createGeneratedWorkingCopy());
      setRecordStatus('idle');
      setCommunicationType(requestedType);
      setDraftDialogOpen(false);
    } catch (error) {
      if (error.name === 'AbortError') setGeneration(previousGeneration);
      else if (previousGeneration.status === 'complete') {
        setGeneration({ ...previousGeneration, error: error.message || 'Unable to generate the draft.' });
      } else {
        setGeneration({ status: 'error', text: '', error: error.message || 'Unable to generate the draft.', model: '', stats: {}, draftId: '' });
      }
    } finally {
      generationController.current = null;
    }
  };

  const startBlankDraft = (discardConfirmed = false, requestedType = communicationType) => {
    if (!discardConfirmed && hasUnsavedWorkingCopy(workingCopy)) {
      setPendingWorkingAction({ type: 'blank', communicationType: requestedType });
      return;
    }
    const manualSignatory = signatory || {
      id: '',
      name: '',
      designation: '',
      telephone: '',
      email: '',
    };
    const profile = normalizeOfficeProfile(officeProfile || {});
    const document = createDraftDocument({
      communicationType: requestedType,
      metadata: {
        ...documentDetails,
        recipient,
        signatoryId: manualSignatory.id,
        signatory: manualSignatory,
        officeProfile: profile,
      },
      body: '[DRAFT BODY]',
      bodySource: 'user',
      styleProfile: profile.documentStyle,
    });
    const rendered = renderStructuredDraft(document);
    const body = rendered.layout.blocks.find((block) => block.role === 'body');

    setGeneration({
      status: 'complete',
      text: rendered.text,
      document: rendered.document,
      error: '',
      model: 'Manual draft',
      stats: {},
      draftId: '',
    });
    setSelectedDraftId('');
    setDraftSaveStatus('unsaved');
    setWorkingCopy(createGeneratedWorkingCopy());
    setRecordStatus('idle');
    setParagraphStatus({ status: 'idle', error: '' });
    setCommunicationType(requestedType);
    setWorkspaceView('compose');
    setDraftDialogOpen(false);
    if (body) {
      rememberSelection({ start: body.start, end: body.end });
      window.setTimeout(() => {
        draftTextareaRef.current?.focus();
        draftTextareaRef.current?.setBodySelection?.(0, body.content.length);
      }, 0);
    }
  };

  const copyDraft = async () => {
    try {
      await copyText(renderDraftClipboardText(generation.document, generation.text));
      setDraftCopyStatus('copied');
    } catch {
      setDraftCopyStatus('error');
    }
    window.setTimeout(() => setDraftCopyStatus('idle'), 1400);
  };

  const saveDraftChanges = async ({ separateVersion = false } = {}) => {
    if (workingCopy.mode !== 'working' || workingCopy.configurationDirty) {
      setGeneration((current) => ({ ...current, error: workingCopy.configurationDirty ? 'Apply the changed communication details before saving.' : 'Open or create a draft before saving.' }));
      return;
    }
    try {
      setDraftSaveStatus(separateVersion ? 'versioning' : 'saving');
      const payload = {
        issueId: issue.id,
        baseDraftId: workingCopy.baseDraftId,
        baseVersion: workingCopy.baseVersion,
        communicationType,
        signatoryId: signatory?.id || '',
        signatoryName: signatory?.name || '',
        recipientRelationship,
        recipient,
        documentDetails,
        instruction,
        additionalInstruction,
        content: generation.text,
        document: generation.document || legacyDraftToDocument(generation.text, communicationType),
        model: generation.model,
        selectedCommunicationIds,
        selectedReferenceIds,
        selectedNoteIds,
      };
      const saved = separateVersion
        ? await saveDraftSnapshot(payload)
        : await saveDraft(payload);
      setGeneration((current) => ({ ...current, draftId: saved.id }));
      setDrafts((current) => [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) => b.version - a.version).slice(0, MAX_DRAFTS_PER_ISSUE));
      setSelectedDraftId(saved.id);
      setDraftSaveStatus('saved');
      setWorkingCopy(createSavedWorkingCopy(saved));
      setRecordStatus('idle');
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
    setAdditionalInstruction(draft.additionalInstruction || '');
    setSelectedCommunicationIds(draft.selectedCommunicationIds || []);
    setSelectedReferenceIds(draft.selectedReferenceIds || []);
    setSelectedNoteIds(draft.selectedNoteIds || []);
    setGeneration({ status: 'complete', text: draft.content, document: draft.document, error: '', model: draft.model, stats: {}, draftId: draft.id });
    setDraftSaveStatus('saved');
    setWorkingCopy(createSavedWorkingCopy(draft));
    setWorkspaceView('compose');
    setRecordStatus('idle');
    setParagraphStatus({ status: 'idle', error: '' });
  };

  const requestSavedDraft = (draftId) => {
    if (!draftId) return;
    if (hasUnsavedWorkingCopy(workingCopy)) {
      setPendingWorkingAction({ type: 'load', draftId });
      return;
    }
    loadSavedDraft(draftId);
  };

  const discardWorkingCopy = () => {
    const base = workingCopy.baseDraftId
      ? drafts.find((draft) => draft.id === workingCopy.baseDraftId)
      : null;
    if (base) {
      loadSavedDraft(base.id);
      return;
    }
    setGeneration({ status: 'idle', text: '', error: '', model: '', stats: {}, draftId: '' });
    setSelectedDraftId('');
    rememberSelection({ start: 0, end: 0 });
    setDraftSaveStatus('idle');
    setWorkingCopy(EMPTY_DRAFT_WORKING_COPY);
    setRecordStatus('idle');
    setWorkspaceView('compose');
  };

  const confirmWorkingAction = async () => {
    const action = pendingWorkingAction;
    setPendingWorkingAction(null);
    if (action?.type === 'load') loadSavedDraft(action.draftId);
    if (action?.type === 'discard') discardWorkingCopy();
    if (action?.type === 'generate') await generateDraft(Boolean(action.cloudConfirmed), true, action.communicationType || communicationType);
    if (action?.type === 'blank') startBlankDraft(true, action.communicationType || communicationType);
  };

  const currentSavedDraft = drafts.find((draft) => draft.id === generation.draftId) || null;
  const recordedCommunication = generation.draftId ? communications.find((item) => item.draftId === generation.draftId) : null;
  const isLegacyDocument = generation.document?.blocks?.some((block) => block.role === 'legacyDocument');

  const insertParagraph = (content) => {
    if (generation.status !== 'complete' || readOnly) return;
    if (!isLegacyDocument && draftTextareaRef.current?.insertText) {
      draftTextareaRef.current.insertText(content, 'paragraph-bank');
      setWorkspaceView('compose');
      return;
    }
    let next;
    try {
      next = insertDraftBodyText({
        document: generation.document,
        fullText: generation.text,
        selectionStart: selection.start,
        selectionEnd: selection.end,
        content,
        source: 'paragraph-bank',
      });
    } catch {
      const start = Math.min(selection.start, generation.text.length);
      const end = Math.min(selection.end, generation.text.length);
      const before = generation.text.slice(0, start);
      const after = generation.text.slice(end);
      const prefix = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
      const suffix = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
      const paragraph = content.trim();
      const text = `${before}${prefix}${paragraph}${suffix}${after}`;
      const cursor = before.length + prefix.length + paragraph.length;
      next = { text, document: legacyDraftToDocument(text, communicationType), selection: { start: cursor, end: cursor } };
    }
    setGeneration((current) => ({ ...current, text: next.text, document: next.document }));
    setDraftSaveStatus('dirty');
    setWorkingCopy((current) => markWorkingCopyChanged(current));
    setRecordStatus('idle');
    setWorkspaceView('compose');
    rememberSelection(next.selection);
    window.setTimeout(() => {
      draftTextareaRef.current?.focus();
      const body = next.layout?.blocks.find((block) => block.role === 'body');
      if (body && draftTextareaRef.current?.setBodySelection) draftTextareaRef.current.setBodySelection(
        next.selection.start - body.start,
        next.selection.end - body.start,
      );
      else draftTextareaRef.current?.setSelectionRange?.(next.selection.start, next.selection.end);
    }, 0);
  };

  const applyBankAddress = (entry) => {
    if (generation.status !== 'complete' || readOnly) return;
    const nextRecipient = {
      ...recipient,
      address: entry.content,
    };
    try {
      const document = {
        ...generation.document,
        metadata: {
          ...generation.document.metadata,
          recipient: nextRecipient,
        },
      };
      const rendered = renderStructuredDraft(document);
      setRecipient(nextRecipient);
      setGeneration((current) => ({
        ...current,
        text: rendered.text,
        document: rendered.document,
        draftId: '',
      }));
      setDraftSaveStatus('dirty');
      setWorkingCopy((current) => markWorkingCopyChanged(current));
      setRecordStatus('idle');
    } catch (error) {
      setGeneration((current) => ({ ...current, error: error.message || 'Unable to apply the saved address.' }));
    }
  };

  const exportDraft = async () => {
    if (draftExportStatus === 'exporting') return;
    try {
      setDraftExportStatus('exporting');
      const { downloadDraftAsDocx } = await import('./renderers/draftDocxRenderer');
      await downloadDraftAsDocx({
        document: generation.document,
        content: generation.text,
        title: documentDetails.subject || issue.shortTitle,
        version: currentSavedDraft?.version,
      });
      setDraftExportStatus('complete');
      window.setTimeout(() => setDraftExportStatus('idle'), 1400);
    } catch (error) {
      setDraftExportStatus('idle');
      setGeneration((current) => ({ ...current, error: error.message || 'Unable to export draft.' }));
    }
  };

  const regenerateSelection = async (cloudConfirmed = false) => {
    const activeSelection = pendingRegenerationSelection.current || selectionRef.current;
    if (!generation.text.slice(activeSelection.start, activeSelection.end).trim()) {
      setParagraphStatus({ status: 'error', error: 'Select the passage you want AI to improve.' });
      draftTextareaRef.current?.focus();
      return;
    }
    if (aiPreferences.mode === 'cloud' && !cloudConfirmed) {
      if (!auth.workspace?.id) {
        setParagraphStatus({ status: 'error', error: 'Sign in to an active workspace before using Cloud AI.' });
        return;
      }
      pendingRegenerationSelection.current = activeSelection;
      setCloudConsent('paragraph');
      return;
    }
    pendingRegenerationSelection.current = null;
    const controller = new AbortController();
    generationController.current = controller;
      setParagraphStatus({ status: 'regenerating', error: '' });
    try {
      const provider = createDraftAIProvider(aiPreferences.mode === 'cloud'
        ? { mode: 'cloud', workspaceId: auth.workspace.id, issueId: issue.id, provider: aiPreferences.cloudProvider, taskLevel: aiPreferences.geminiTaskLevel }
        : { mode: 'local', settings: aiSettings });
      const result = await regenerateDraftBodySelection({
        provider,
        document: generation.document,
        fullText: generation.text,
        selectionStart: activeSelection.start,
        selectionEnd: activeSelection.end,
        context: useDetailedContext ? context.text : `Issue subject: ${documentDetails.subject || issue.shortTitle}`,
        communicationType,
        instruction: [instruction, additionalInstruction].filter((value) => value?.trim()).join('\n\n'),
        signal: controller.signal,
      });
      setGeneration((current) => ({
        ...current,
        text: result.text,
        document: result.document,
        model: result.model || current.model,
      }));
      setDraftSaveStatus('dirty');
      setWorkingCopy((current) => markWorkingCopyChanged(current));
      setRecordStatus('idle');
      rememberSelection(result.selection);
      setParagraphStatus({ status: 'complete', error: '' });
      window.requestAnimationFrame(() => {
        draftTextareaRef.current?.focus();
        const body = result.layout?.blocks.find((block) => block.role === 'body');
        if (body && draftTextareaRef.current?.setBodySelection) draftTextareaRef.current.setBodySelection(
          result.selection.start - body.start,
          result.selection.end - body.start,
        );
      });
    } catch (error) {
      setParagraphStatus(error.name === 'AbortError' ? { status: 'idle', error: '' } : { status: 'error', error: error.message || 'Unable to improve the selected passage.' });
    } finally {
      generationController.current = null;
    }
  };

  const recordOutgoingCommunication = async () => {
    if (!currentSavedDraft || draftSaveStatus === 'dirty') {
      setRecordStatus('error');
      return;
    }
    try {
      setRecordStatus('saving');
      let recordedDraft = currentSavedDraft;
      if (!currentSavedDraft.immutableSnapshot) {
        recordedDraft = await saveDraftSnapshot({
          ...currentSavedDraft,
          id: undefined,
          baseDraftId: currentSavedDraft.id,
          baseVersion: currentSavedDraft.version,
          content: generation.text,
          document: generation.document,
        });
        setDrafts((current) => [recordedDraft, ...current.filter((item) => item.id !== recordedDraft.id)]
          .sort((a, b) => b.version - a.version)
          .slice(0, MAX_DRAFTS_PER_ISSUE));
        setSelectedDraftId(recordedDraft.id);
        setGeneration((current) => ({ ...current, draftId: recordedDraft.id }));
        setWorkingCopy(createSavedWorkingCopy(recordedDraft));
      }
      const savedRecipient = recordedDraft.recipient || {};
      const savedDocumentDetails = recordedDraft.documentDetails || {};
      const savedCommunicationType = recordedDraft.communicationType || communicationType;
      const correspondent = [savedRecipient.name, savedRecipient.organization].filter(Boolean).join(', ') || 'Recipient not specified';
      await onSaveCommunication({
        communicationDate: savedDocumentDetails.issueDate || todayISO(),
        communicationType: 'Letter issued',
        correspondent,
        details: `${savedCommunicationType} recorded as outgoing communication${currentSavedDraft.signatoryName ? ` and signed by ${currentSavedDraft.signatoryName}` : ''}.`,
        documentDate: savedDocumentDetails.issueDate || todayISO(),
        sourceSubject: savedDocumentDetails.subject || issue.shortTitle,
        sourceDigest: `Prepared from saved draft version ${recordedDraft.version}. The editable draft remains available in Drafting.`,
        draftId: recordedDraft.id,
        draftVersion: recordedDraft.version,
        officialCommunicationType: savedCommunicationType,
        signatoryId: recordedDraft.signatoryId,
        signatoryName: recordedDraft.signatoryName,
      });
      setRecordStatus('recorded');
    } catch {
      setRecordStatus('error');
    }
  };

  const providerLabel = aiPreferences.cloudProvider === 'openai' ? 'OpenAI' : 'Gemini';
  const geminiTask = getGeminiTaskLevel(aiPreferences.geminiTaskLevel);
  const selectedPassage = generation.text.slice(selection.start, selection.end).trim();
  const selectedWordCount = selectedPassage ? selectedPassage.split(/\s+/).filter(Boolean).length : 0;
  const draftReview = useMemo(
    () =>
      generation.document
        ? validateDraftDocument(generation.document)
        : { errors: [], warnings: [] },
    [generation.document],
  );
  const draftReviewCount = draftReview.errors.length + draftReview.warnings.length;
  const changeAIMode = (mode) => {
    generationController.current?.abort();
    setAIPreferences((current) => ({ ...current, mode }));
    setCloudConsent('');
    setGeneration((current) => ({ ...current, status: current.status === 'error' ? 'idle' : current.status, error: '' }));
    setParagraphStatus({ status: 'idle', error: '' });
  };

  const updateRichDraftBody = (bodyRichText, source = 'user') => {
    try {
      const document = replaceDraftBodyRichText(generation.document, bodyRichText, source);
      const rendered = renderStructuredDraft(document);
      setGeneration((current) => ({
        ...current,
        text: rendered.text,
        document: rendered.document,
        draftId: '',
      }));
      setDraftSaveStatus('dirty');
      setWorkingCopy((current) => markWorkingCopyChanged(current));
      setRecordStatus('idle');
    } catch (error) {
      setGeneration((current) => ({ ...current, error: error.message || 'Unable to update the draft body.' }));
    }
  };

  const updateDraftStyle = (changes) => {
    try {
      const document = {
        ...generation.document,
        styleProfileSnapshot: {
          ...generation.document.styleProfileSnapshot,
          ...changes,
        },
      };
      const rendered = renderStructuredDraft(document);
      setGeneration((current) => ({
        ...current,
        text: rendered.text,
        document: rendered.document,
        draftId: '',
      }));
      setDraftSaveStatus('dirty');
      setWorkingCopy((current) => markWorkingCopyChanged(current));
      setRecordStatus('idle');
    } catch (error) {
      setGeneration((current) => ({ ...current, error: error.message || 'Unable to update document formatting.' }));
    }
  };

  const updateRichSelection = ({ start, end }) => {
    try {
      const rendered = renderStructuredDraft(generation.document);
      const body = rendered.layout.blocks.find((block) => block.role === 'body');
      if (body) {
        rememberSelection({ start: body.start + start, end: body.start + end });
        if (end > start && paragraphStatus.error) setParagraphStatus({ status: 'idle', error: '' });
      }
    } catch {
      // Legacy drafts continue using the plain-text selection path.
    }
  };

  return (
    <>
    <section className="surface overflow-hidden rounded-md border-t-4 border-t-teal-600">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dce6e4] px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-700" /><h2 className="text-base font-semibold text-[#17333b]">Drafting workspace</h2></div>
          <p className="mt-1 text-sm text-slate-600">Write the communication, complete its details and record it when issued.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 border-b border-[#dce6e4] bg-slate-50 p-1.5" role="tablist" aria-label="Drafting workspace">
        {[
          ['compose', 'Compose'],
          ['versions', `Draft history${drafts.length ? ` (${drafts.length})` : ''}`],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={workspaceView === value}
            onClick={() => setWorkspaceView(value)}
            className={`min-h-10 min-w-[104px] shrink-0 rounded px-2 py-2 text-xs font-semibold transition-colors sm:min-w-0 sm:text-sm ${
              workspaceView === value
                ? 'bg-white text-teal-800 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sourceNote && (
        <div className="flex items-start gap-3 border-b border-indigo-200 bg-indigo-50 px-4 py-3 sm:px-5">
          <FilePenLine className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
          <div>
            <p className="text-xs font-semibold text-indigo-950">
              Preparing communication from Note {sourceNote.sequence}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-indigo-800">
              Includes the Issue subject, current position, running summary
              {sourceNoteLinkedCount
                ? ` and ${sourceNoteLinkedCount} linked record${sourceNoteLinkedCount === 1 ? '' : 's'}`
                : ''}
              .
            </p>
          </div>
        </div>
      )}

      {workspaceView === 'bank' && (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-[#dce6e4] bg-white px-4 py-3 sm:px-5">
            <div>
              <p className="text-sm font-semibold text-[#17333b]">Manage Paragraph Bank</p>
              <p className="mt-0.5 text-xs text-slate-500">Add or maintain reusable wording and addresses.</p>
            </div>
            <button type="button" onClick={() => setWorkspaceView('compose')} className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Back to draft</button>
          </div>
          <ParagraphBankPanel
            entries={paragraphBank}
            auth={auth}
            communicationType={communicationType}
            canInsert={generation.status === 'complete' && !readOnly}
            onInsert={insertParagraph}
            onUseAddress={applyBankAddress}
            onChanged={async () => {
              const entries = await getParagraphBankEntries();
              setParagraphBank(entries);
            }}
          />
        </>
      )}

      <div className={workspaceView === 'bank' ? 'hidden' : 'border-t border-[#dce6e4]'}>
        {workspaceView === 'versions' && drafts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-[#e3ebe9] bg-white px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><History className="h-4 w-4 text-cyan-700" />Draft history <span className="font-normal text-slate-500">({drafts.length}/{MAX_DRAFTS_PER_ISSUE})</span></div>
            <select aria-label="Draft history" value={selectedDraftId} onChange={(event) => requestSavedDraft(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700 sm:max-w-md">
              <option value="" disabled>Select a draft</option>
              {drafts.map((draft) => <option key={draft.id} value={draft.id}>Version {draft.version} - {draft.communicationType || 'Communication'} - {new Date(draft.updatedAt || draft.createdAt).toLocaleString()}</option>)}
            </select>
          </div>
        )}
        {workspaceView === 'versions' && drafts.length === 0 && (
          <div className="px-4 py-12 text-center sm:px-5">
            <History className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No saved versions yet</p>
            <p className="mt-1 text-xs text-slate-500">Generate or prepare a draft, then save a version when it is worth retaining.</p>
            <button type="button" onClick={() => setWorkspaceView('compose')} className="mt-4 inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Open composer</button>
          </div>
        )}
        {workspaceView === 'compose' && generation.status === 'idle' && (
          <div className="mx-auto flex min-h-[420px] w-full max-w-xl flex-col justify-center px-4 py-10 sm:px-5">
            <div className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-700"><FilePenLine className="h-5 w-5" /></div>
              <h3 className="mt-3 text-base font-semibold text-[#17333b]">What are you preparing?</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">Choose a format, then write directly or ask AI to prepare an editable first version.</p>
            </div>
            <div className="mt-5">
              <AdaptiveSelect ariaLabel="Communication type to prepare" value={draftDialogType} onChange={setDraftDialogType} options={COMMUNICATION_TYPES} includeBlank={false} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {!readOnly && <button type="button" onClick={() => startBlankDraft(false, draftDialogType)} className="flex min-h-16 items-center gap-3 rounded-md bg-teal-700 px-4 py-3 text-left text-white shadow-sm hover:bg-teal-800"><FileOutput className="h-5 w-5 shrink-0" /><span><span className="block text-sm font-semibold">Start blank draft</span><span className="mt-0.5 block text-xs leading-4 text-teal-50">Open the editor immediately and write yourself.</span></span></button>}
              {!readOnly && <button type="button" onClick={() => openAIPreparation('details')} className="flex min-h-16 items-center gap-3 rounded-md border border-cyan-300 bg-cyan-50 px-4 py-3 text-left text-cyan-950 hover:bg-cyan-100"><Sparkles className="h-5 w-5 shrink-0 text-cyan-700" /><span><span className="block text-sm font-semibold">Prepare with AI</span><span className="mt-0.5 block text-xs leading-4 text-cyan-800">Choose the brief and information, then generate once.</span></span></button>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              {drafts.length > 0 && <button type="button" onClick={() => setWorkspaceView('versions')} className="inline-flex h-9 items-center text-xs font-semibold text-slate-600 hover:text-teal-800"><History className="mr-2 h-4 w-4" />Open saved draft</button>}
            </div>
          </div>
        )}
        {workspaceView === 'compose' && generation.status === 'generating' && <div className="flex min-h-36 items-center justify-center gap-3 border-t border-[#e3ebe9] px-4 py-8 text-center text-sm font-medium text-slate-600"><LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-cyan-700" />{aiPreferences.mode === 'cloud' ? `Generating through ${providerLabel}${aiPreferences.cloudProvider === 'gemini' ? ` for a ${geminiTask.label.toLowerCase()} task` : ''}.` : 'Generating locally. The first request may include model loading time.'}</div>}
        {workspaceView === 'compose' && generation.status === 'error' && (
          <div className="border-t border-red-200 bg-red-50 px-4 py-5 text-center sm:px-5">
            <p className="text-sm font-medium text-red-800">{generation.error}</p>
            <button type="button" onClick={() => setGeneration({ status: 'idle', text: '', error: '', model: '', stats: {}, draftId: '' })} className="mt-3 inline-flex h-9 items-center rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-800 hover:bg-red-100">Back to communication choices</button>
          </div>
        )}
        {generation.status === 'complete' && (
          <div className={`border-t border-[#e3ebe9] px-4 py-4 sm:px-5 ${workspaceView === 'compose' ? '' : 'hidden'}`}>
            {workingCopy.mode === 'working' && workingCopy.baseVersion > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"><GitBranch className="h-4 w-4 shrink-0 text-teal-700" />Editing saved draft {workingCopy.baseVersion}. Save updates this draft; preserve a separate copy only when needed.</div>
            )}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div><h3 className="text-sm font-semibold text-[#17333b]">Communication draft</h3><p className="mt-1 text-xs text-slate-500">{workingCopy.dirty ? 'Unsaved changes' : 'Changes saved'}</p></div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                {!readOnly && workingCopy.mode === 'working' && <button type="button" onClick={() => saveDraftChanges()} disabled={!generation.text.trim() || !workingCopy.dirty || workingCopy.configurationDirty || ['saving', 'versioning'].includes(draftSaveStatus)} className={`inline-flex h-10 min-w-24 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-white disabled:bg-slate-300 sm:h-9 ${draftSaveStatus === 'error' ? 'bg-red-700' : 'bg-teal-700 hover:bg-teal-800'}`}>{draftSaveStatus === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : draftSaveStatus === 'saved' && !workingCopy.dirty ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{draftSaveStatus === 'saving' ? 'Saving...' : draftSaveStatus === 'error' ? 'Save failed' : draftSaveStatus === 'saved' && !workingCopy.dirty ? 'Saved' : 'Save'}</button>}
                {!readOnly && <button type="button" onPointerDown={() => { if (selectedWordCount) pendingRegenerationSelection.current = { ...selectionRef.current }; }} onMouseDown={(event) => { if (selectedWordCount) { pendingRegenerationSelection.current = { ...selectionRef.current }; event.preventDefault(); } }} onClick={() => selectedWordCount ? regenerateSelection() : setParagraphStatus({ status: 'hint', error: 'Select the sentence or paragraph in the draft body that you want AI to rewrite.' })} disabled={paragraphStatus.status === 'regenerating'} title={selectedWordCount ? `Rewrite the selected ${selectedWordCount} words with AI` : 'Select text in the draft body before using AI rewrite'} className="inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-900 hover:bg-cyan-100 disabled:opacity-50 sm:h-9"><Sparkles className="h-4 w-4" />{paragraphStatus.status === 'regenerating' ? 'Rewriting...' : 'Rewrite selection'}</button>}
                <button type="button" onClick={exportDraft} disabled={draftExportStatus === 'exporting'} className="inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 sm:h-9">{draftExportStatus === 'exporting' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : draftExportStatus === 'complete' ? <Check className="h-4 w-4 text-emerald-700" /> : <Download className="h-4 w-4" />}{draftExportStatus === 'exporting' ? 'Preparing...' : draftExportStatus === 'complete' ? 'Downloaded' : 'Download Word'}</button>
                {!readOnly && workingCopy.mode === 'working' && (
                  <details className="relative">
                    <summary className="flex h-10 min-w-20 cursor-pointer list-none items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:h-9"><MoreHorizontal className="h-4 w-4" />More</summary>
                    <div className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                      {workingCopy.baseVersion > 0 && <button type="button" onClick={() => saveDraftChanges({ separateVersion: true })} disabled={!generation.text.trim() || workingCopy.configurationDirty || ['saving', 'versioning'].includes(draftSaveStatus)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><GitBranch className="h-4 w-4" />Save as separate version</button>}
                      <button type="button" onClick={copyDraft} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"><Clipboard className="h-4 w-4" />{draftCopyStatus === 'copied' ? 'Copied' : 'Copy text'}</button>
                      <button type="button" onClick={() => openAIPreparation('details')} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-cyan-800 hover:bg-cyan-50"><Sparkles className="h-4 w-4" />Prepare again with AI</button>
                      <button type="button" onClick={() => hasUnsavedWorkingCopy(workingCopy) ? setPendingWorkingAction({ type: 'discard' }) : discardWorkingCopy()} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50"><RotateCcw className="h-4 w-4" />Discard changes</button>
                    </div>
                  </details>
                )}
              </div>
            </div>
            {generation.error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">{generation.error}</div>}
            {paragraphStatus.error && <div className={`mb-3 rounded-md border px-3 py-2 text-xs leading-5 ${paragraphStatus.status === 'hint' ? 'border-cyan-200 bg-cyan-50 text-cyan-900' : 'border-red-200 bg-red-50 text-red-800'}`}>{paragraphStatus.error}</div>}
            {workingCopy.configurationDirty && <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Communication details changed. Apply the selected communication type before saving.</div>}
            {isLegacyDocument ? (
              <>
                <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">This older draft uses the plain-text editor. New blank and AI drafts use the structured editor with formatting tools.</div>
                <textarea ref={draftTextareaRef} value={generation.text} readOnly={readOnly} onSelect={(event) => rememberSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })} onChange={(event) => { const text = event.target.value; setGeneration((current) => ({ ...current, text, document: legacyDraftToDocument(text, communicationType), draftId: '' })); setDraftSaveStatus('dirty'); setWorkingCopy((current) => markWorkingCopyChanged(current)); setRecordStatus('idle'); }} rows={22} aria-label={readOnly ? 'Read-only draft' : 'Editable working draft'} className={`min-h-[48vh] w-full resize-y rounded-md border border-slate-300 px-4 py-4 font-serif text-[13px] leading-6 text-slate-900 shadow-inner sm:min-h-[620px] sm:px-5 sm:py-5 sm:text-sm sm:leading-7 ${readOnly ? 'bg-slate-50' : 'bg-white'}`} />
              </>
            ) : (
              <Suspense fallback={<div className="flex min-h-[420px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Opening editor...</div>}>
                <DraftDocumentEditor
                  ref={draftTextareaRef}
                  document={generation.document}
                  readOnly={readOnly}
                  paragraphBankEntries={paragraphBank}
                  communicationType={communicationType}
                  signatories={authorizedSignatories}
                  signatoryId={signatoryId}
                  onChange={updateRichDraftBody}
                  onSelectionChange={updateRichSelection}
                  onStyleChange={updateDraftStyle}
                  onUseAddress={applyBankAddress}
                  onOpenParagraphBank={() => setWorkspaceView('bank')}
                  onCommunicationTypeChange={changeCommunicationType}
                  onSignatoryChange={changeSignatory}
                  onDocumentDetailChange={updateDocumentDetails}
                  onRecipientChange={updateRecipient}
                />
              </Suspense>
            )}
            <section className={`mt-4 rounded-md border ${draftReviewCount ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={`text-sm font-semibold ${draftReviewCount ? 'text-amber-950' : 'text-emerald-950'}`}>Finish communication</p>
                  <p className={`mt-0.5 text-xs leading-5 ${draftReviewCount ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {draftReviewCount
                      ? `${draftReviewCount} detail${draftReviewCount === 1 ? '' : 's'} should be reviewed before issue. Open Review in the side tools.`
                      : 'Document details are complete. Review the wording before issue.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={exportDraft} disabled={draftExportStatus === 'exporting'} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{draftExportStatus === 'exporting' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download Word</button>
                  {!readOnly && <button type="button" onClick={recordOutgoingCommunication} disabled={!currentSavedDraft || draftSaveStatus === 'dirty' || recordStatus === 'saving' || Boolean(recordedCommunication) || recordStatus === 'recorded'} title={!currentSavedDraft || draftSaveStatus === 'dirty' ? 'Save the current draft before recording it as issued.' : 'Record this saved draft as an outgoing communication.'} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300">{recordStatus === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileOutput className="h-4 w-4" />}{recordedCommunication || recordStatus === 'recorded' ? 'Recorded as issued' : recordStatus === 'saving' ? 'Recording...' : 'Record as issued'}</button>}
                </div>
              </div>
            </section>
            <div aria-live="polite">
              {paragraphStatus.status === 'complete' && <p className="mt-2 text-xs text-emerald-700">Selected passage improved. Review it and save the draft.</p>}
            </div>
            {recordStatus === 'error' && <p className="mt-2 text-xs text-red-700">Save the current draft version before recording the outgoing communication.</p>}
          </div>
        )}
      </div>
    </section>
    {draftDialogOpen && (
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation">
        <button
          type="button"
          aria-label="Close draft preparation"
          disabled={generation.status === 'generating'}
          onClick={() => setDraftDialogOpen(false)}
          className="absolute inset-0 cursor-default disabled:cursor-wait"
        />
        <section
          ref={draftDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-preparation-title"
          className="relative z-10 flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-lg border border-slate-200 bg-white shadow-2xl sm:max-h-[88dvh] sm:rounded-lg"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <FilePenLine className="h-5 w-5 text-teal-700" />
                <h3 id="draft-preparation-title" className="text-base font-semibold text-[#17333b]">Prepare draft with AI</h3>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">Set the format, intent and source material. AI will create one editable first version.</p>
            </div>
            <button type="button" data-autofocus title="Close" aria-label="Close draft preparation" disabled={generation.status === 'generating'} onClick={() => setDraftDialogOpen(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X className="h-4 w-4" /></button>
          </header>

          <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-slate-200 bg-slate-50 p-1.5" role="tablist" aria-label="Draft preparation">
            {[
              ['details', 'Brief & format'],
              ['context', `Information used (${context.selectedSourceCount})`],
            ].map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={draftDialogTab === value} onClick={() => setDraftDialogTab(value)} className={`min-h-10 rounded-md px-3 text-xs font-semibold sm:text-sm ${draftDialogTab === value ? 'bg-white text-teal-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {draftDialogTab === 'details' ? (
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">AI provider</p>
                    <p className="mt-0.5 text-xs text-slate-500">{aiPreferences.mode === 'cloud' ? `${providerLabel}${aiPreferences.cloudProvider === 'gemini' ? ` · ${geminiTask.label}` : ''}` : aiSettings?.model || 'Loading local settings...'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <AIModeControl value={aiPreferences.mode} onChange={changeAIMode} cloudDisabled={!auth.workspace?.id} disabled={generation.status === 'generating' || paragraphStatus.status === 'regenerating'} compact />
                    <Link to="/settings" className="text-xs font-semibold text-teal-700 hover:underline">Configure</Link>
                  </div>
                </div>
                {aiPreferences.mode === 'cloud' && aiPreferences.cloudProvider === 'gemini' && <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3"><GeminiTaskLevelControl value={aiPreferences.geminiTaskLevel} onChange={(value) => setAIPreferences((current) => ({ ...current, geminiTaskLevel: value }))} disabled={generation.status === 'generating'} label="Draft complexity" /></div>}

                <fieldset disabled={readOnly || generation.status === 'generating'} className="mt-4 grid gap-3 disabled:opacity-70 sm:grid-cols-2">
                  <div>
                    <AdaptiveSelect label="Communication type" value={draftDialogType} onChange={setDraftDialogType} options={COMMUNICATION_TYPES} includeBlank={false} disabled={generation.status === 'generating'} />
                    {generation.status === 'complete' && <p className="mt-1 text-xs text-slate-500">Current draft: {communicationType}. Changing its type preserves the body and rebuilds the official structure.</p>}
                  </div>
                  <AdaptiveSelect label="Authorized signatory" value={signatoryId} onChange={changeSignatory} options={authorizedSignatories.map((officer) => ({ value: officer.id, label: officer.designation ? `${officer.name} - ${officer.designation}` : officer.name }))} placeholder="Select signatory" disabled={generation.status === 'generating' || !authorizedSignatories.length} />
                  <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Recipient relationship</span><select value={recipientRelationship} onChange={(event) => { setRecipientRelationship(event.target.value); markDraftDirty(); }} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">{RECIPIENT_RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}</select></label>
                  <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Recipient organization <span className="font-normal text-slate-500">(optional)</span></span><input value={recipient.organization} onChange={(event) => updateRecipient('organization', event.target.value)} placeholder="Example: Department of Legal Affairs" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" /></label>
                  <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-medium text-slate-700">Saved Note as drafting basis <span className="font-normal text-slate-500">(optional)</span></span><select value={selectedNoteIds.length === 1 ? selectedNoteIds[0] : ''} onChange={(event) => chooseDraftingNote(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="">{selectedNoteIds.length > 1 ? `${selectedNoteIds.length} Notes selected in Information used` : 'Draft without a saved Note'}</option>{notes.map((item) => <option key={item.id} value={item.id}>Note {item.sequence} - {item.content.slice(0, 90)}{item.content.length > 90 ? '...' : ''}</option>)}</select><span className="mt-1 block text-xs leading-5 text-slate-500">When selected, its reasoning and proposal guide the communication. Linked communications and references are included automatically.</span></label>
                  <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-medium text-slate-700">Goal / requested outcome {!selectedNotes.length && <span className="text-red-600">*</span>}</span><textarea rows={2} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={selectedNotes.length ? 'Optional: clarify or modify the course proposed in the selected Note.' : 'Example: request the attached office to furnish verified comments by 15 August 2026.'} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900" /><span className="mt-1 block text-xs leading-5 text-slate-500">State what the recipient should know, decide or do, including any supported deadline. This is required when drafting without a Note.</span></label>
                  <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                    <label className="flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={useDetailedContext} onChange={(event) => setUseDetailedContext(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-700" /><span><span className="block font-medium">Use Issue information</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Use the selected Issue material in the body.</span></span></label>
                    <label className={`flex items-start gap-2 rounded-md border px-3 py-3 text-sm text-slate-700 ${summary ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}><input type="checkbox" checked={options.summary && Boolean(summary)} disabled={!summary} onChange={(event) => setOptions((current) => ({ ...current, summary: event.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-700" /><span><span className="block font-medium">Include running summary</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{summary ? `Use version ${summary.version || 1} as current factual context.` : 'No running summary is available.'}</span></span></label>
                  </div>

                  <details className="rounded-md border border-slate-200 bg-slate-50 sm:col-span-2">
                    <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-slate-700">More document details <span className="font-normal text-slate-500">(optional)</span></summary>
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

                  <div className="overflow-hidden rounded-md border border-slate-200 bg-white sm:col-span-2">
                    <button type="button" aria-expanded={advancedSettingsOpen} onClick={() => setAdvancedSettingsOpen((current) => !current)} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Settings2 className="h-4 w-4 text-cyan-700" />Advanced settings</span>
                      <span className="text-xs font-medium text-slate-500">{advancedSettingsOpen ? 'Hide' : 'Review prompt'}</span>
                    </button>
                    {advancedSettingsOpen && (
                      <div className="space-y-4 border-t border-slate-200 bg-slate-50 px-3 py-4 sm:px-4">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label htmlFor="additional-draft-instruction" className="text-sm font-medium text-slate-700">Additional AI instruction <span className="font-normal text-slate-500">(optional)</span></label>
                            <button type="button" onClick={() => setAdditionalInstruction('')} disabled={!additionalInstruction} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
                          </div>
                          <textarea id="additional-draft-instruction" rows={4} value={additionalInstruction} onChange={(event) => setAdditionalInstruction(event.target.value)} placeholder="Example: Begin with the earlier correspondence, keep the request firm but courteous, and place the deadline in the final paragraph." className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900" />
                          <p className="mt-1 text-xs leading-5 text-slate-500">Use this for emphasis, sequence, tone or wording. It cannot override factual safeguards or protected document structure.</p>
                        </div>

                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3">
                          <div className="flex items-start gap-2">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                            <div><p className="text-xs font-semibold text-emerald-900">Protected drafting rules</p><p className="mt-1 text-xs leading-5 text-emerald-800">Government form, sender and recipient direction, factual discipline and body-only output remain protected.</p></div>
                          </div>
                          <textarea readOnly aria-label="Protected AI drafting rules" rows={4} value={draftRequestPreview.instructions} className="mt-3 w-full resize-y rounded-md border border-emerald-200 bg-white px-3 py-2 font-mono text-[11px] leading-5 text-slate-700" />
                        </div>

                        <div>
                          <div className="flex flex-wrap items-end justify-between gap-2">
                            <div><p className="text-sm font-medium text-slate-700">Final prompt preview</p><p className="mt-0.5 text-xs text-slate-500">This is the complete instruction and selected information that will be sent.</p></div>
                            <p className="text-xs tabular-nums text-slate-500">{draftRequestPreview.words.toLocaleString()} words | about {draftRequestPreview.estimatedTokens.toLocaleString()} tokens</p>
                          </div>
                          <textarea readOnly aria-label="Final AI prompt preview" rows={12} value={draftRequestPreview.text} className="mt-2 max-h-80 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-3 font-mono text-[11px] leading-5 text-slate-700" />
                          <p className="mt-1 text-xs leading-5 text-slate-500">Token count is an approximation. The provider may tokenize the same text differently.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {!authorizedSignatories.length && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2">Choose authorized signatories in <Link to="/settings" className="font-semibold underline">Settings</Link> before generating official communication.</div>}
                  {authorizedSignatories.length > 0 && !signatory && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2">Select the officer who will sign this communication.</div>}
                </fieldset>
              </div>
            ) : (
              <div className="grid min-h-[420px] lg:grid-cols-[360px_minmax(0,1fr)]">
                <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
                  <div className="border-b border-slate-200 px-4 py-4">
                    <h4 className="text-sm font-semibold text-slate-800">Automatically included</h4>
                    <div className="mt-3 space-y-2">
                      <Option label="Issue details" checked={options.issueDetails} onChange={(checked) => setOptions((current) => ({ ...current, issueDetails: checked }))} />
                      <Option label="Current position" checked={options.currentPosition} disabled={!issue.currentPosition} onChange={(checked) => setOptions((current) => ({ ...current, currentPosition: checked }))} />
                      <Option label="Latest running summary" checked={options.summary} disabled={!summary} onChange={(checked) => setOptions((current) => ({ ...current, summary: checked }))} />
                    </div>
                  </div>
                  <div className="flex border-b border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Context sources">
                    {['Communications', 'References', 'Notes'].map((tab) => <button key={tab} type="button" role="tab" aria-selected={sourceTab === tab} onClick={() => setSourceTab(tab)} className={`flex-1 rounded px-2 py-2 text-xs font-semibold ${sourceTab === tab ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{tab} <span className="tabular-nums">({tab === 'Communications' ? communications.length : tab === 'References' ? references.length : notes.length})</span></button>)}
                  </div>
                  {sourceTab === 'Communications' ? (
                    <SourceSelector items={communications} selectedIds={selectedCommunicationIds} onToggle={(id) => toggleId(setSelectedCommunicationIds, id)} onSelectAll={() => setSelectedCommunicationIds(communications.map((item) => item.id))} onClear={() => setSelectedCommunicationIds([])} emptyText="No communications recorded." renderItem={(item) => <CommunicationLabel communication={item} />} />
                  ) : sourceTab === 'References' ? (
                    <SourceSelector items={references} selectedIds={selectedReferenceIds} onToggle={(id) => toggleId(setSelectedReferenceIds, id)} onSelectAll={() => setSelectedReferenceIds(references.map((item) => item.id))} onClear={() => setSelectedReferenceIds([])} emptyText="No references recorded." renderItem={(item) => <ReferenceLabel reference={item} />} />
                  ) : (
                    <SourceSelector items={notes} selectedIds={selectedNoteIds} onToggle={(id) => toggleId(setSelectedNoteIds, id)} onSelectAll={() => setSelectedNoteIds(notes.map((item) => item.id))} onClear={() => setSelectedNoteIds([])} emptyText="No notes recorded." renderItem={(item) => <NoteLabel note={item} />} />
                  )}
                </aside>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-500"><span className="font-semibold tabular-nums text-slate-700">{context.wordCount}</span> words <span className="mx-1 text-slate-300">|</span> <span className="font-semibold tabular-nums text-slate-700">{context.selectedSourceCount}</span> selected</div>
                    <button type="button" onClick={copyContext} disabled={!context.text} className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-white disabled:bg-slate-300 ${copyStatus === 'copied' ? 'bg-emerald-700' : copyStatus === 'error' ? 'bg-red-700' : 'bg-teal-700 hover:bg-teal-800'}`}>{copyStatus === 'copied' ? <Check className="h-4 w-4" /> : copyStatus === 'error' ? <X className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy context'}</button>
                  </div>
                  <pre className="max-h-[480px] min-h-[300px] overflow-auto whitespace-pre-wrap break-words px-4 py-5 font-sans text-sm leading-6 text-slate-700">{context.text || 'Select at least one context section or source.'}</pre>
                </div>
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
            {generation.error && <p className="mb-2 text-xs text-red-700">{generation.error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">{aiPreferences.mode === 'cloud' ? `Cloud AI · ${providerLabel}` : 'Local AI'}{useDetailedContext ? ` · ${context.selectedSourceCount} items selected` : ' · Issue subject only'}</p>
              {generation.status === 'generating' ? (
                <div className="flex gap-2">
                  <button type="button" disabled className="inline-flex h-10 min-w-40 flex-1 items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 text-sm font-semibold text-white"><LoaderCircle className="h-4 w-4 animate-spin" />Generating...</button>
                  <button type="button" title="Stop generation" onClick={() => generationController.current?.abort()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"><Square className="h-4 w-4" /><span className="sr-only">Stop generation</span></button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDraftDialogOpen(false)} className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={() => generateDraft(false, false, draftDialogType)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-teal-800"><Sparkles className="h-4 w-4" />{generation.status === 'complete' ? 'Generate new draft' : 'Generate draft'}</button>
                </div>
              )}
            </div>
          </footer>
        </section>
      </div>
    )}
    <ConfirmDialog
      open={Boolean(cloudConsent)}
      title={`Send official context to ${providerLabel}?`}
      message={cloudConsent === 'paragraph'
        ? `The selected passage, surrounding draft, drafting brief and relevant Issue context will be sent to ${providerLabel}. Usage and status are logged, but the AI log does not store the prompt or generated text.`
        : `The drafting brief and Issue sources currently selected will be sent to ${providerLabel}. Usage and status are logged, but the AI log does not store the prompt or generated text.`}
      confirmLabel="Send and generate"
      onCancel={() => {
        pendingRegenerationSelection.current = null;
        setCloudConsent('');
      }}
      onConfirm={() => {
        const action = cloudConsent;
        setCloudConsent('');
        if (action === 'paragraph') regenerateSelection(true);
        else generateDraft(true, true, draftDialogType);
      }}
    />
    <ConfirmDialog
      open={Boolean(pendingWorkingAction)}
      title={pendingWorkingAction?.type === 'load' ? 'Open another saved version?' : ['generate', 'blank'].includes(pendingWorkingAction?.type) ? 'Replace this draft?' : 'Discard changes?'}
      message={workingCopy.baseVersion
        ? `Unsaved changes based on version ${workingCopy.baseVersion} will be discarded. The saved version itself will remain unchanged.`
        : 'Unsaved changes in this draft will be discarded.'}
      confirmLabel={pendingWorkingAction?.type === 'load' ? 'Discard and open' : pendingWorkingAction?.type === 'generate' ? 'Discard and generate' : pendingWorkingAction?.type === 'blank' ? 'Discard and start blank' : 'Discard changes'}
      destructive
      onCancel={() => setPendingWorkingAction(null)}
      onConfirm={confirmWorkingAction}
    />
    </>
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

function NoteLabel({ note }) {
  return <><span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800"><FilePenLine className="h-3.5 w-3.5" />Note {note.sequence} · {note.authorName || 'Officer'}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600">{note.content}</span></>;
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
