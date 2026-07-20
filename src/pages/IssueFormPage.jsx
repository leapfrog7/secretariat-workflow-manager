import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import IssueForm from '../components/issues/IssueForm';
import { getSettings } from '../db/database';
import { createIssue, getIssueById, updateIssue } from '../db/issueRepository';
import { getAllOfficers } from '../db/officerRepository';
import { useToast } from '../components/common/ToastProvider';

export default function IssueFormPage({ mode }) {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, saveStatus: 'idle', error: '', issue: null, settings: null, officers: [], saveError: '' });

  useEffect(() => {
    async function load() {
      try {
        const [settings, officers] = await Promise.all([getSettings(), getAllOfficers({ includeInactive: false })]);
        const issue = mode === 'edit' ? await getIssueById(issueId) : null;
        if (mode === 'edit' && !issue) throw new Error('Issue not found.');
        setState({ loading: false, saveStatus: 'idle', error: '', issue, settings, officers, saveError: '' });
      } catch (error) {
        setState({ loading: false, saveStatus: 'idle', error: error.message, issue: null, settings: null, officers: [], saveError: '' });
      }
    }
    load();
  }, [mode, issueId]);

  const save = async (issue) => {
    try {
      setState((current) => ({ ...current, saveStatus: 'saving', saveError: '' }));
      const saved = mode === 'edit' ? await updateIssue(issueId, issue) : await createIssue(issue);
      setState((current) => ({ ...current, saveStatus: 'saved' }));
      showToast(mode === 'edit' ? 'Issue updated.' : 'Issue created.');
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      navigate(`/issues/${saved.id || issueId}`);
    } catch (error) {
      setState((current) => ({ ...current, saveStatus: 'idle', saveError: error.message || 'Unable to save Issue.' }));
    }
  };

  if (state.loading) return <LoadingState message="Loading Issue form..." />;
  if (state.error) return <ErrorState message={state.error} />;

  return (
    <>
      <PageHeader
        title={mode === 'edit' ? 'Edit Issue' : 'Create Issue'}
        description={mode === 'edit' ? 'Update the Issue details.' : 'Record the Issue and allocate it for action.'}
      />
      <IssueForm
        initialIssue={state.issue}
        settings={state.settings}
        officers={state.officers}
        onSubmit={save}
        onCancel={() => navigate(mode === 'edit' ? `/issues/${issueId}` : '/issues')}
        saveStatus={state.saveStatus}
        submitLabel={mode === 'edit' ? 'Save changes' : 'Create Issue'}
        saveError={state.saveError}
      />
    </>
  );
}
