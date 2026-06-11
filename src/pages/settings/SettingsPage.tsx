import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAllSettings, setSetting } from "@/lib/queries/settings";
import { Settings, Save, Upload } from "lucide-react";

export function SettingsPage() {
  const [tab, setTab] = useState<'identity' | 'branding' | 'backup' | 'whatsapp' | 'email' | 'system'>('identity');
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: getAllSettings });
  const [local, setLocal] = useState<Record<string, string>>({});

  useEffect(() => { if (Object.keys(settings).length) setLocal(settings); }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      for (const [k, v] of Object.entries(local)) await setSetting(k, v);
    },
  });

  const set = (k: string, v: string) => setLocal(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="flex items-center gap-2 bg-maroon-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-maroon-700 disabled:opacity-60">
          <Save size={15} />
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {(['identity', 'branding', 'backup', 'whatsapp', 'email', 'system'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {tab === 'identity' && (
          <>
            <h2 className="font-semibold text-gray-900">Lab Identity</h2>
            <Field label="Lab Name" value={local.lab_name ?? ''} onChange={v => set('lab_name', v)} />
            <Field label="Address" value={local.address_line ?? ''} onChange={v => set('address_line', v)} />
            <Field label="Phone Numbers" value={local.phones ?? ''} onChange={v => set('phones', v)} />
            <Field label="Timings" value={local.timings ?? ''} onChange={v => set('timings', v)} />
            <Field label="Technician Name" value={local.technician_name ?? ''} onChange={v => set('technician_name', v)} />
            <Field label="Qualification" value={local.technician_qual ?? ''} onChange={v => set('technician_qual', v)} />
            <Field label="Equipment Line" value={local.equipment_line ?? ''} onChange={v => set('equipment_line', v)} multiline />
            <Field label="Footer Tests Line" value={local.footer_tests_line ?? ''} onChange={v => set('footer_tests_line', v)} multiline />
          </>
        )}
        {tab === 'whatsapp' && (
          <>
            <h2 className="font-semibold text-gray-900">WhatsApp Delivery</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
              <select value={local.whatsapp_mode ?? 'semi'} onChange={e => set('whatsapp_mode', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-maroon-500">
                <option value="semi">Semi-automatic (opens WhatsApp, one click)</option>
                <option value="api">Automatic via WhatsApp Business API</option>
              </select>
            </div>
            {local.whatsapp_mode === 'api' && (
              <>
                <Field label="BSP API Key" value={local.bsp_api_key ?? ''} onChange={v => set('bsp_api_key', v)} type="password" />
                <Field label="Template Name" value={local.bsp_template_name ?? ''} onChange={v => set('bsp_template_name', v)} />
              </>
            )}
          </>
        )}
        {tab === 'email' && (
          <>
            <h2 className="font-semibold text-gray-900">Email (SMTP)</h2>
            <Field label="SMTP Host" value={local.smtp_host ?? ''} onChange={v => set('smtp_host', v)} placeholder="smtp.gmail.com" />
            <Field label="SMTP Port" value={local.smtp_port ?? '587'} onChange={v => set('smtp_port', v)} />
            <Field label="Email Address" value={local.smtp_user ?? ''} onChange={v => set('smtp_user', v)} />
            <Field label="App Password" value={local.smtp_pass ?? ''} onChange={v => set('smtp_pass', v)} type="password" />
          </>
        )}
        {tab === 'system' && (
          <>
            <h2 className="font-semibold text-gray-900">System</h2>
            <Field label="Next Test Number" value={local.next_test_no ?? '1'} onChange={v => set('next_test_no', v)} type="number" />
            <Field label="Financial Year" value={local.financial_year ?? '2026-2027'} onChange={v => set('financial_year', v)} />
            <Field label="Backup Retention (days)" value={local.backup_retention_days ?? '30'} onChange={v => set('backup_retention_days', v)} type="number" />
          </>
        )}
        {tab === 'backup' && (
          <>
            <h2 className="font-semibold text-gray-900">Backup Locations</h2>
            <Field label="Backup Folder 1 (local/USB)" value={local.backup_dir_1 ?? ''} onChange={v => set('backup_dir_1', v)} placeholder="C:\\Backups\\SCL" />
            <Field label="Backup Folder 2 (Google Drive)" value={local.backup_dir_2 ?? ''} onChange={v => set('backup_dir_2', v)} placeholder="Path to Drive-synced folder" />
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
      )}
    </div>
  );
}
