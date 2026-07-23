import { useState } from 'react';
import { CheckCircle2, LoaderCircle, Save, X } from 'lucide-react';

export default function OfficerForm({ initialOfficer, onSubmit, onCancel }) {
  const [officer, setOfficer] = useState(initialOfficer || { name: '', designation: '', telephone: '', email: '', section: '', role: 'Other', isActive: true });
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const update = (field, value) => setOfficer((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!officer.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaveStatus('saving');
    try {
      await onSubmit(officer);
      setSaveStatus('saved');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save officer.');
      setSaveStatus('idle');
    }
  };
  return (
    <form onSubmit={submit} className="border-y border-[#dce6e4] bg-[#f7faf9] px-3 py-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Input label="Name" value={officer.name} onChange={(value) => update('name', value)} error={error} required />
        <Input label="Designation" value={officer.designation} onChange={(value) => update('designation', value)} />
        <Input label="Telephone" value={officer.telephone} onChange={(value) => update('telephone', value)} />
        <Input label="Email" value={officer.email} onChange={(value) => update('email', value)} />
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={officer.isActive} onChange={(event) => update('isActive', event.target.checked)} className="h-4 w-4" />
          Available for allocation
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" onClick={onCancel} disabled={saveStatus !== 'idle'} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium disabled:opacity-50 sm:h-10"><X className="h-4 w-4" />Cancel</button>
        <button type="submit" disabled={saveStatus !== 'idle'} className={`inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-white shadow-sm sm:h-10 ${saveStatus === 'saved' ? 'bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400'}`}>{saveStatus === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save officer'}</button>
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
