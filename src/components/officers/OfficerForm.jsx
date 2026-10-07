import { useRef, useState } from 'react';
import { Check, Save, X } from 'lucide-react';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import OperationStatus from '../ui/OperationStatus';

export default function OfficerForm({ initialOfficer, onSubmit, onCancel }) {
  const [officer, setOfficer] = useState(initialOfficer || { name: '', designation: '', telephone: '', email: '', section: '', role: 'Other', isActive: true });
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const submitting = useRef(false);
  const update = (field, value) => {
    setError('');
    setOfficer((current) => ({ ...current, [field]: value }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!officer.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setSaveStatus('saving');
    try {
      await onSubmit(officer);
      setSaveStatus('saved');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save officer.');
      setSaveStatus('idle');
    } finally {
      submitting.current = false;
    }
  };
  return (
    <form onSubmit={submit} className="border-y border-[#dce6e4] bg-[#f7faf9] px-3 py-4">
      {error ? <Alert tone="danger" title="Officer not saved" className="mb-3">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Input label="Name" value={officer.name} onChange={(value) => update('name', value)} required />
        <Input label="Designation" value={officer.designation} onChange={(value) => update('designation', value)} />
        <Input label="Telephone" value={officer.telephone} onChange={(value) => update('telephone', value)} />
        <Input label="Email" value={officer.email} onChange={(value) => update('email', value)} />
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={officer.isActive} onChange={(event) => update('isActive', event.target.checked)} className="h-4 w-4" />
          Available for allocation
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 items-center gap-2 sm:flex sm:justify-end">
        <OperationStatus state={error ? 'error' : saveStatus} className="col-span-2 sm:mr-auto" />
        <Button type="button" onClick={onCancel} disabled={saveStatus !== 'idle'} variant="secondary" size="lg"><X className="h-4 w-4" />Cancel</Button>
        <Button type="submit" disabled={saveStatus === 'saved'} loading={saveStatus === 'saving'} loadingLabel="Saving…" variant={saveStatus === 'saved' ? 'success' : 'primary'} size="lg" className="min-w-32">{saveStatus === 'saved' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saveStatus === 'saved' ? 'Saved' : 'Save officer'}</Button>
      </div>
    </form>
  );
}

function Input({ label, value, onChange, error, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}{required && <span className="text-red-700"> *</span>}</span>
      <input value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm" />
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}
