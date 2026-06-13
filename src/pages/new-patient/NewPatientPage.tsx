import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { promptDialog } from "@/lib/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listDoctors, upsertDoctor } from "@/lib/queries/doctors";
import { searchTests, listPanels, listTests } from "@/lib/queries/tests";
import { createPatient, getNextTestNo } from "@/lib/queries/patients";
import { useSession } from "@/lib/session";
import { Test, Doctor, Panel, AgeUnit, Sex, PaymentMode } from "@/types";
import { nowISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search, X, Plus, ChevronDown, Save } from "lucide-react";

interface SelectedTest {
  test: Test;
  price: number;
}

const labelCls = "block text-[12.5px] font-medium text-[#5d5953] mb-1.5";
const errCls = "text-[12px] text-[#b91c1c] mt-1.5";
const sectionLabelCls = "text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d] mb-3";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className={errCls}>{msg}</p>;
}

/** Segmented pill group — maroon active, used for Sex and Payment Mode. */
function SegmentedPills<T extends string>({
  options, value, onChange, render, stretch,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => string;
  stretch?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-full border border-[#e7e5e1] bg-[#faf9f7] p-0.5", stretch && "flex w-full")}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
            stretch && "flex-1",
            value === opt
              ? "bg-maroon-600 text-white shadow-[0_1px_2px_rgba(110,23,23,0.35)]"
              : "text-[#5d5953] hover:bg-[#f1efec] hover:text-[#1a1a1e]"
          )}
        >
          {render ? render(opt) : opt}
        </button>
      ))}
    </div>
  );
}

function BillRow({ label, value, bold, danger }: { label: string; value: string; bold?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={cn("text-[13.5px]", bold ? "font-semibold text-[#1a1a1e]" : "text-[#5d5953]")}>{label}</span>
      <span className={cn(
        "text-[13.5px] tabular-nums transition-colors",
        bold && "font-bold",
        danger ? "text-[#b91c1c]" : "text-[#1a1a1e]"
      )}>{value}</span>
    </div>
  );
}

export function NewPatientPage() {
  const navigate = useNavigate();
  const user = useSession(s => s.user);
  const qc = useQueryClient();

  // Patient fields
  const [testNo, setTestNo] = useState<number>(0);
  const [title, setTitle] = useState("Mr.");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [ageUnit, setAgeUnit] = useState<AgeUnit>("YRS");
  const [sex, setSex] = useState<Sex>("MALE");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [collectedAt, setCollectedAt] = useState("SHARMA CLINICAL LABORATORY");

  // Billing
  const [concession, setConcession] = useState(0);
  const [mode, setMode] = useState<PaymentMode>("CASH");

  // Test selection
  const [testQuery, setTestQuery] = useState("");
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [testDropdown, setTestDropdown] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);   // synchronous double-submit guard (setSaving is async)

  const { data: nextNo } = useQuery({ queryKey: ['next-test-no'], queryFn: getNextTestNo });
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors', 'active'], queryFn: () => listDoctors() });
  const { data: panels = [] } = useQuery({ queryKey: ['panels'], queryFn: listPanels });
  const { data: testResults = [] } = useQuery({
    queryKey: ['test-search', testQuery],
    queryFn: () => searchTests(testQuery),
    enabled: testQuery.length >= 1,
  });

  useEffect(() => { if (nextNo) setTestNo(nextNo); }, [nextNo]);

  // Auto-set sex from title
  useEffect(() => {
    if (['Mr.', 'Master'].includes(title)) setSex('MALE');
    else if (['Mrs.', 'Miss', 'Ms.'].includes(title)) setSex('FEMALE');
  }, [title]);

  const total = selectedTests.reduce((s, t) => s + t.price, 0);
  const net = Math.max(0, total - concession);

  function addTest(test: Test) {
    if (selectedTests.find(t => t.test.id === test.id)) return;
    setSelectedTests(prev => [...prev, { test, price: test.price }]);
    setTestQuery("");
    setTestDropdown(false);
  }

  function removeTest(testId: number) {
    setSelectedTests(prev => prev.filter(t => t.test.id !== testId));
  }

  async function addDoctorInline() {
    const name = (await promptDialog({ title: 'New referring doctor', placeholder: 'Doctor name', confirmText: 'Add' }))?.trim();
    if (!name) return;
    try {
      const id = await upsertDoctor(name.toUpperCase());
      await qc.invalidateQueries({ queryKey: ['doctors'] });
      setDoctorId(id);
    } catch (err) {
      alert(String(err));
    }
  }

  async function addPanel(panelCode: string) {
    // A panel chip adds the sellable BUNDLE test (one bill line, e.g. CBC ₹250);
    // on save it expands into the panel's member tests for result entry.
    const panelTests = await listTests(panelCode, true);
    const bundle = panelTests.find(t => t.is_panel);
    setSelectedTests(prev => {
      const have = new Set(prev.map(t => t.test.id));
      const additions = (bundle ? [bundle] : panelTests)
        .filter(t => !have.has(t.id))
        .map(t => ({ test: t, price: t.price }));
      return [...prev, ...additions];
    });
    setTestQuery("");
    setTestDropdown(false);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Patient name is required";
    if (!age || parseFloat(age) <= 0) e.age = "Valid age is required";
    if (parseFloat(age) > 120 && ageUnit === 'YRS') e.age = "Age cannot exceed 120 years";
    if (phone && !/^\d{10}$/.test(phone)) e.phone = "Phone must be 10 digits";
    if (selectedTests.length === 0) e.tests = "Select at least one test";
    if (concession > total) e.concession = "Concession cannot exceed total";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(andEnterResults = false) {
    if (submitting.current) return;   // block a second click in the same tick (duplicate patient)
    if (!validate()) return;
    submitting.current = true;
    setSaving(true);
    try {
      const prices: Record<number, number> = {};
      for (const st of selectedTests) prices[st.test.id] = st.price;

      const patientId = await createPatient({
        title, name: name.trim(), age: parseFloat(age), age_unit: ageUnit,
        sex, phone, email, address, doctor_id: doctorId,
        collected_at: collectedAt, sample_time: nowISO(),
        test_ids: selectedTests.map(t => t.test.id),
        prices, concession, received: net, mode,
      }, user!.id);

      qc.invalidateQueries({ queryKey: ['today-patients'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['next-test-no'] });
      qc.invalidateQueries({ queryKey: ['patients-search'] });   // so the new patient shows in the Patients list

      if (andEnterResults) navigate(`/result-entry/${patientId}`);
      else navigate('/dashboard');
    } catch (err) {
      setErrors({ _: String(err) });
      submitting.current = false;   // allow retry only on failure (success navigates away)
    } finally {
      setSaving(false);
    }
  }

  const quickPanels = ['CBC', 'LFT', 'KFT', 'LIPID', 'DIAB', 'URINE', 'THY', 'SERO'];

  // Enter = advance to the next field (skips textareas) — fast keyboard data entry (§7.3).
  function handleEnterNext(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA') return;
    e.preventDefault();
    const fields = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('input, select')
    ).filter(el => !(el as HTMLInputElement).disabled);
    const idx = fields.indexOf(t);
    if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus();
  }

  const todayStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="pt-4 space-y-4 animate-fade-up">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#8a857d]">
          Receipt <span className="font-mono font-semibold text-[#5d5953]">#{testNo || '—'}</span>
          <span className="mx-1.5 text-[#d6d3cd]">·</span>
          {todayStr}
        </p>
        <div className="flex items-center gap-2.5">
          <button onClick={() => handleSave(false)} disabled={saving} className="btn btn-secondary">
            Save &amp; Close
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} className="btn btn-primary">
            <Save size={15} strokeWidth={1.8} />
            {saving ? 'Saving…' : 'Save & Enter Results'}
            <kbd className="text-[10px] font-semibold bg-white/20 rounded px-1.5 py-0.5">⏎</kbd>
          </button>
        </div>
      </div>

      {/* Save error banner */}
      {errors._ && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#f3d4d4] bg-[#fdf6f6] px-4 py-3 animate-fade-up">
          <span className="mt-[5px] w-2 h-2 rounded-full bg-[#b91c1c] shrink-0" />
          <p className="text-[13px] text-[#a31e1e]">{errors._}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* LEFT: Patient details (3/5) */}
        <div className="card p-6 lg:col-span-3" onKeyDown={handleEnterNext}>
          <h2 className={sectionLabelCls}>Patient details</h2>

          <div className="space-y-4">
            {/* Title + Name */}
            <div className="flex gap-3">
              <div className="w-24 shrink-0">
                <label className={labelCls}>Title</label>
                <select value={title} onChange={e => setTitle(e.target.value)} className="field">
                  {['Mr.','Mrs.','Miss','Ms.','Master','Baby','Dr.','B/O'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className={labelCls}>Full Name <span className="text-maroon-600">*</span></label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value.toUpperCase())}
                  placeholder="PATIENT NAME"
                  className={cn("field font-medium uppercase", errors.name && "!border-[#dc2626]")}
                />
                <FieldError msg={errors.name} />
              </div>
            </div>

            {/* Age + unit + Sex */}
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <label className={labelCls}>Age <span className="text-maroon-600">*</span></label>
                <div className="flex gap-2">
                  <input
                    type="number" value={age} onChange={e => setAge(e.target.value)} min="0" placeholder="Age"
                    className={cn("field flex-1 tabular-nums", errors.age && "!border-[#dc2626]")}
                  />
                  <select value={ageUnit} onChange={e => setAgeUnit(e.target.value as AgeUnit)} className="field !w-24 shrink-0">
                    <option>YRS</option><option>MTH</option><option>DAYS</option>
                  </select>
                </div>
                <FieldError msg={errors.age} />
              </div>
              <div className="shrink-0">
                <label className={labelCls}>Sex</label>
                <div className="h-[38px] flex items-center">
                  <SegmentedPills
                    options={['MALE','FEMALE','OTHER'] as const}
                    value={sex}
                    onChange={s => setSex(s)}
                    render={s => (s === 'MALE' ? 'M' : s === 'FEMALE' ? 'F' : 'O')}
                  />
                </div>
              </div>
            </div>

            {/* Phone + Email */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Phone (WhatsApp)</label>
                <input
                  value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile"
                  className={cn("field tabular-nums", errors.phone && "!border-[#dc2626]")}
                />
                <FieldError msg={errors.phone} />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Email <span className="text-[#a8a29b] font-normal">(optional)</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@email.com" className="field" />
              </div>
            </div>

            {/* Referred By */}
            <div>
              <label className={labelCls}>Referred By</label>
              <div className="flex gap-2">
                <select
                  value={doctorId ?? ''}
                  onChange={e => setDoctorId(e.target.value ? parseInt(e.target.value) : null)}
                  className="field flex-1"
                >
                  <option value="">— Select Doctor —</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button type="button" onClick={addDoctorInline} title="Add a new referring doctor" className="btn btn-ghost shrink-0 !text-maroon-700">
                  <Plus size={15} strokeWidth={1.8} /> Add
                </button>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className={labelCls}>Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} className="field" />
            </div>

            {/* Collected At */}
            <div>
              <label className={labelCls}>Collected At</label>
              <input value={collectedAt} onChange={e => setCollectedAt(e.target.value)} className="field" />
            </div>
          </div>
        </div>

        {/* RIGHT: Tests + Billing (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tests */}
          <div className="card p-6">
            <h2 className={sectionLabelCls}>Tests</h2>

            {/* Quick panel chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {quickPanels.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => addPanel(p)}
                  className="rounded-full border border-[#e7e5e1] px-3 py-1 text-[12px] font-medium text-[#5d5953] transition-colors hover:border-maroon-300 hover:bg-maroon-50 hover:text-maroon-700"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search size={15} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29b] pointer-events-none" />
              <input
                value={testQuery}
                onChange={e => { setTestQuery(e.target.value); setTestDropdown(true); }}
                onFocus={() => setTestDropdown(true)}
                placeholder="Search tests by code or name…"
                className="field !pl-9"
              />
              {testDropdown && testResults.length > 0 && (
                <div className="card absolute z-10 top-full left-0 right-0 mt-1.5 max-h-52 overflow-y-auto shadow-[var(--shadow-pop)] animate-scale-in py-1">
                  {testResults.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => addTest(t)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-[13.5px] transition-colors hover:bg-[#faf9f7]"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-[11.5px] text-[#8a857d] mr-2">{t.code}</span>
                        <span className="text-[#1a1a1e]">{t.name}</span>
                      </span>
                      <span className="text-[12.5px] text-[#8a857d] tabular-nums shrink-0">₹{t.price}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected tests */}
            <FieldError msg={errors.tests} />
            <div className={cn("max-h-52 overflow-y-auto", errors.tests && "mt-2")}>
              {selectedTests.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13.5px] text-[#8a857d]">No tests selected yet</p>
                  <p className="text-[12px] text-[#a8a29b] mt-1">Use the panel pills or search above</p>
                </div>
              ) : selectedTests.map(st => (
                <div
                  key={st.test.id}
                  className="group flex items-center justify-between gap-3 px-1 py-2 border-b border-[#f6f5f3] last:border-0 transition-colors hover:bg-[#faf9f7] rounded-lg"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-[11.5px] text-[#a8a29b] mr-2">{st.test.code}</span>
                    <span className="text-[13.5px] text-[#1a1a1e]">{st.test.name}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-[12.5px] text-[#a8a29b]">₹</span>
                    <input
                      type="number"
                      value={st.price}
                      onChange={e => {
                        const p = Math.max(0, parseFloat(e.target.value) || 0);
                        setSelectedTests(prev => prev.map(t => t.test.id === st.test.id ? { ...t, price: p } : t));
                      }}
                      className="w-16 bg-transparent text-right text-[13.5px] tabular-nums text-[#1a1a1e] border-0 border-b border-transparent transition-colors focus:border-maroon-600 focus:outline-none focus-visible:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeTest(st.test.id)}
                      className="ml-1 text-[#a8a29b] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#b91c1c]"
                      title="Remove test"
                    >
                      <X size={14} strokeWidth={1.8} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Billing */}
          <div className="card p-6">
            <h2 className={sectionLabelCls}>Billing</h2>
            <div className="space-y-2">
              <BillRow label="Total" value={`₹${total}`} />
              <div className="flex items-center justify-between py-0.5">
                <label className="text-[13.5px] text-[#5d5953]">Concession (₹)</label>
                <input
                  type="number"
                  value={concession}
                  onChange={e => setConcession(Math.max(0, Math.min(total, parseFloat(e.target.value) || 0)))}
                  min={0} max={total}
                  className={cn("field !w-28 text-right tabular-nums !py-1.5", errors.concession && "!border-[#dc2626]")}
                />
              </div>
              {errors.concession && <p className="text-[12px] text-[#b91c1c] text-right">{errors.concession}</p>}
              <div className="border-t border-[#f1efec] pt-2">
                <BillRow label="Amount" value={`₹${net}`} bold />
              </div>
              <div className="pt-1.5">
                <label className={labelCls}>Payment Mode</label>
                <SegmentedPills
                  options={['CASH','UPI','CARD'] as const}
                  value={mode}
                  onChange={m => setMode(m)}
                  stretch
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
