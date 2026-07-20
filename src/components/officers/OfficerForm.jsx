import { useState } from 'react';

export default function OfficerForm({ initialOfficer, onSubmit, onCancel }) {
  const [officer, setOfficer] = useState(initialOfficer || { name: '', designation: '', telephone: '', email: '', section: '', role: 'Other', isActive: true });
  const [error, setError] = useState('');
  const update = (field, value) => setOfficer((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!officer.name.trim()) {
      setError('Name is required.');
      return;
    }
    await onSubmit(officer);
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
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Cancel</button>
        <button type="submit" className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800">Save officer</button>
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
