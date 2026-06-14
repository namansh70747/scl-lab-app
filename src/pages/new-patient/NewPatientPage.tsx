import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { promptDialog } from "@/lib/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listDoctors, upsertDoctor } from "@/lib/queries/doctors";
import { searchTests, listPanels, listTests, getFrequentTests } from "@/lib/queries/tests";
import { createPatient, getNextTestNo } from "@/lib/queries/patients";
import { getAllSettings } from "@/lib/queries/settings";
import { useSession } from "@/lib/session";
import { Test, AgeUnit, Sex, PaymentMode } from "@/types";
import { nowISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search, X, Plus, Save, Zap } from "lucide-react";
import { Combobox } from "@/components/common/Combobox";
import { toast } from "@/lib/toast";

interface SelectedTest {
  test: Test;
  price: number;
}

const labelCls = "block text-[12px] font-medium text-[#6a6b77] mb-1.5";
const errCls = "text-[12px] text-[#b91c1c] mt-1.5";
const sectionLabelCls = "text-[11px] font-semibold uppercase tracking-[0.09em] text-[#9a9cab] mb-3";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className={errCls}>{msg}</p>;
}

/** Segmented pill group — accent active, used for Sex and Payment Mode. */
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
    <div className={cn("inline-flex items-center gap-0.5 rounded-full border border-[#e6e7ee] bg-[#f4f5f8] p-0.5", stretch && "flex w-full")}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          tabIndex={-1}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all",
            stretch && "flex-1",
            value === opt
              ? "bg-gradient-to-b from-[#7c83ff] to-[#6366f1] text-white shadow-[0_2px_8px_-2px_rgba(99,102,241,0.6)]"
              : "text-[#54555f] hover:bg-white hover:text-[#14151c]"
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
      <span className={cn("text-[13.5px]", bold ? "font-semibold text-[#14151c]" : "text-[#54555f]")}>{label}</span>
      <span className={cn(
        "text-[13.5px] tabular-nums transition-colors",
        bold && "font-bold text-[16px]",
        danger ? "text-[#b91c1c]" : "text-[#14151c]"
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
  const [collectedAt, setCollectedAt] = useState("");

  // Billing
  const [concession, setConcession] = useState(0);
  const [mode, setMode] = useState<PaymentMode>("CASH");

  // Test selection
  const [testQuery, setTestQuery] = useState("");
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [testDropdown, setTestDropdown] = useState(false);
  const [hl, setHl] = useState(0);   // keyboard-highlighted search row

  // Errors + flow
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);   // synchronous double-submit guard (setSaving is async)
  const nameRef = useRef<HTMLInputElement>(null);
  const sexTouched = useRef(false);

  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: getAllSettings });
  const { data: nextNo } = useQuery({ queryKey: ['next-test-no'], queryFn: getNextTestNo });
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors', 'active'], queryFn: () => listDoctors() });
  const { data: panels = [] } = useQuery({ queryKey: ['panels'], queryFn: listPanels });
  const { data: frequent = [] } = useQuery({ queryKey: ['frequent-tests'], queryFn: () => getFrequentTests(8) });
  const { data: testResults = [] } = useQuery({
    queryKey: ['test-search', testQuery],
    queryFn: () => searchTests(testQuery),
    enabled: testQuery.length >= 1,
  });

  useEffect(() => { if (nextNo) setTestNo(nextNo); }, [nextNo]);
  // Default "Collected At" to this lab's own name (not a hardcoded one).
  useEffect(() => { if (settings.lab_name && !collectedAt) setCollectedAt(settings.lab_name); }, [settings.lab_name]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { nameRef.current?.focus(); }, []);          // jump straight to typing the name
  useEffect(() => { setHl(0); }, [testQuery, testResults.length]);

  // Auto-set sex from title — unless the user has manually chosen a sex this session.
  useEffect(() => {
    if (sexTouched.current) return;
    if (['Mr.', 'Master'].includes(title)) setSex('MALE');
    else if (['Mrs.', 'Miss', 'Ms.'].includes(title)) setSex('FEMALE');
  }, [title]);

  const total = selectedTests.reduce((s, t) => s + t.price, 0);
  const net = Math.max(0, total - concession);

  function addTest(test: Test) {
    setSelectedTests(prev => prev.find(t => t.test.id === test.id) ? prev : [...prev, { test, price: test.price }]);
    setTestQuery("");
    setTestDropdown(false);
  }

  function removeTest(testId: number) {
    setSelectedTests(prev => prev.filter(t => t.test.id !== testId));
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!testResults.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHl(h => Math.min(h + 1, testResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHl(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const t = testResults[hl]; if (t) addTest(t); }
    else if (e.key === 'Escape') { setTestDropdown(false); }
  }

  async function addDoctorInline() {
    const dn = (await promptDialog({ title: 'New referring doctor', placeholder: 'Doctor name', confirmText: 'Add' }))?.trim();
    if (!dn) return;
    try {
      const id = await upsertDoctor(dn.toUpperCase());
      await qc.invalidateQueries({ queryKey: ['doctors'] });
      setDoctorId(id);
      toast.success(`Dr. ${dn} added.`);
    } catch (err) {
      toast.error(err);
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
    const ageNum = parseFloat(age);
    if (!name.trim()) e.name = "Patient name is required";
    if (!age || !Number.isFinite(ageNum) || ageNum <= 0) e.age = "Valid age is required";
    else if (ageNum > 120 && ageUnit === 'YRS') e.age = "Age cannot exceed 120 years";
    if (phone && !/^\d{10}$/.test(phone)) e.phone = "Phone must be 10 digits";
    if (selectedTests.length === 0) e.tests = "Select at least one test";
    if (concession > total) e.concession = "Concession cannot exceed total";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(mode2: "results" | "close") {
    if (submitting.current) return;   // block a second trigger in the same tick (duplicate patient)
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
      qc.invalidateQueries({ queryKey: ['patients-search'] });
      qc.invalidateQueries({ queryKey: ['frequent-tests'] });

      if (mode2 === "results") navigate(`/result-entry/${patientId}`);
      else navigate('/dashboard');
    } catch (err) {
      setErrors({ _: String(err) });
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  }

  // Keep a ref so the global keydown listener always calls the latest handleSave without
  // re-registering on every render (which is what the no-dep-array pattern does).
  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSaveRef.current('results'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const quickPanels = ['CBC', 'LFT', 'KFT', 'LIPID', 'DIAB', 'URINE', 'THY', 'SERO'];

  // Enter = advance to the next field (skips textareas; the test search handles its own Enter).
  function handleEnterNext(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return;   // Cmd/Ctrl+Enter is "save", not "advance"
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA' || t.getAttribute('data-search') === '1') return;
    e.preventDefault();
    const fields = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('input, select')
    ).filter(el => !(el as HTMLInputElement).disabled && el.tabIndex !== -1);
    const idx = fields.indexOf(t);
    if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus();
  }

  const todayStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="pt-4 space-y-4 animate-fade-up" onKeyDown={handleEnterNext}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <p className="text-[13px] text-[#8a8b97]">
            Receipt <span className="font-mono font-bold text-[#14151c]">#{testNo || '—'}</span>
            <span className="mx-1.5 text-[#cdced8]">·</span>
            {todayStr}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleSave("close")} disabled={saving} className="btn btn-secondary text-[13px]">
            Save &amp; Close
          </button>
          <button onClick={() => handleSave("results")} disabled={saving} className="btn btn-accent">
            <Save size={15} strokeWidth={1.9} />
            {saving ? 'Saving…' : 'Save & Enter Results'}
            <kbd className="text-[10px] font-semibold bg-white/20 rounded px-1.5 py-0.5">⌘⏎</kbd>
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
        <div className="card p-6 lg:col-span-3">
          <h2 className={sectionLabelCls}>Patient details</h2>

          <div className="space-y-4">
            {/* Title + Name */}
            <div className="flex gap-3">
              <div className="w-24 shrink-0">
                <label className={labelCls}>Title</label>
                <select value={title} onChange={e => setTitle(e.target.value)} className="field" tabIndex={-1}>
                  {['Mr.','Mrs.','Miss','Ms.','Master','Baby','Dr.','B/O'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className={labelCls}>Full Name <span className="text-[#6366f1]">*</span></label>
                <input
                  ref={nameRef}
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
                <label className={labelCls}>Age <span className="text-[#6366f1]">*</span></label>
                <div className="flex gap-2">
                  <input
                    type="number" value={age} onChange={e => setAge(e.target.value)} min="0" placeholder="Age"
                    className={cn("field flex-1 tabular-nums", errors.age && "!border-[#dc2626]")}
                  />
                  <select value={ageUnit} onChange={e => setAgeUnit(e.target.value as AgeUnit)} className="field !w-24 shrink-0" tabIndex={-1}>
                    <option>YRS</option><option>MTH</option><option>DAYS</option>
                  </select>
                </div>
                <FieldError msg={errors.age} />
              </div>
              <div className="shrink-0">
                <label className={labelCls}>Sex</label>
                <div className="h-[40px] flex items-center">
                  <SegmentedPills
                    options={['MALE','FEMALE','OTHER'] as const}
                    value={sex}
                    onChange={s => { sexTouched.current = true; setSex(s); }}
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
                  value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric" placeholder="10-digit mobile"
                  className={cn("field tabular-nums", errors.phone && "!border-[#dc2626]")}
                />
                <FieldError msg={errors.phone} />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Email <span className="text-[#a3a5b3] font-normal">(optional)</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@email.com" className="field" />
              </div>
            </div>

            {/* Referred By — searchable, most-referred doctors first */}
            <div>
              <label className={labelCls}>Referred By</label>
              <div className="flex gap-2">
                <Combobox
                  className="flex-1"
                  value={doctorId}
                  onChange={setDoctorId}
                  options={doctors.map(d => ({ value: d.id, label: d.name }))}
                  placeholder="Type to search, or Self / Walk-in"
                />
                <button type="button" tabIndex={-1} onClick={addDoctorInline} title="Add a new referring doctor" className="btn btn-ghost shrink-0 !text-[#4f46e5]">
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
              <input value={collectedAt} onChange={e => setCollectedAt(e.target.value)} className="field" tabIndex={-1} />
            </div>
          </div>
        </div>

        {/* RIGHT: Tests + Billing (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tests */}
          <div className="card p-6">
            <h2 className={sectionLabelCls}>Tests</h2>

            {/* Search (top, keyboard-first) */}
            <div className="relative mb-3">
              <Search size={15} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a5b3] pointer-events-none" />
              <input
                data-search="1"
                value={testQuery}
                onChange={e => { setTestQuery(e.target.value); setTestDropdown(true); }}
                onFocus={() => setTestDropdown(true)}
                onKeyDown={onSearchKey}
                placeholder="Search & press Enter to add…"
                className="field !pl-9"
              />
              {testDropdown && testResults.length > 0 && (
                <div className="card absolute z-10 top-full left-0 right-0 mt-1.5 max-h-60 overflow-y-auto shadow-[var(--shadow-pop)] animate-scale-in py-1">
                  {testResults.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      onMouseEnter={() => setHl(i)}
                      onClick={() => addTest(t)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-[13.5px] transition-colors",
                        i === hl ? "bg-[#eef0fe]" : "hover:bg-[#fafafe]"
                      )}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-[11.5px] text-[#9a9cab] mr-2">{t.code}</span>
                        <span className="text-[#14151c]">{t.name}</span>
                      </span>
                      <span className="text-[12.5px] text-[#8a8b97] tabular-nums shrink-0">₹{t.price}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick panel chips */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {quickPanels.map(p => (
                <button
                  key={p}
                  type="button"
                  tabIndex={-1}
                  onClick={() => addPanel(p)}
                  className="rounded-full border border-[#e6e7ee] px-3 py-1 text-[12px] font-medium text-[#54555f] transition-all hover:border-[#c7c9ff] hover:bg-[#eef0fe] hover:text-[#4f46e5]"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Frequent tests (one-tap, usage-ranked) */}
            {frequent.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#a3a5b3]">
                  <Zap size={11} /> Frequent
                </span>
                {frequent.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => addTest(t)}
                    title={`₹${t.price}`}
                    className="rounded-full bg-[#f4f5f8] px-2.5 py-1 text-[11.5px] font-medium text-[#54555f] transition-colors hover:bg-[#eef0fe] hover:text-[#4f46e5]"
                  >
                    {t.code}
                  </button>
                ))}
              </div>
            )}

            {/* Selected tests */}
            <FieldError msg={errors.tests} />
            <div className={cn("max-h-56 overflow-y-auto -mx-1 px-1", errors.tests && "mt-2")}>
              {selectedTests.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13.5px] text-[#8a8b97]">No tests selected yet</p>
                  <p className="text-[12px] text-[#a3a5b3] mt-1">Search, or tap a panel / frequent chip</p>
                </div>
              ) : selectedTests.map(st => (
                <div
                  key={st.test.id}
                  className="group flex items-center justify-between gap-3 px-2 py-2 border-b border-[#f1f1f5] last:border-0 transition-colors hover:bg-[#fafafe] rounded-lg"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-[11.5px] text-[#a3a5b3] mr-2">{st.test.code}</span>
                    <span className="text-[13.5px] text-[#14151c]">{st.test.name}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-[12.5px] text-[#a3a5b3]">₹</span>
                    <input
                      type="number"
                      tabIndex={-1}
                      value={st.price}
                      onChange={e => {
                        const p = Math.max(0, parseFloat(e.target.value) || 0);
                        setSelectedTests(prev => prev.map(t => t.test.id === st.test.id ? { ...t, price: p } : t));
                      }}
                      className="w-16 bg-transparent text-right text-[13.5px] tabular-nums text-[#14151c] border-0 border-b border-transparent transition-colors focus:border-[#6366f1] focus:outline-none"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => removeTest(st.test.id)}
                      className="ml-1 text-[#a3a5b3] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#b91c1c]"
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
              <BillRow label={`Total (${selectedTests.length} test${selectedTests.length === 1 ? '' : 's'})`} value={`₹${total}`} />
              <div className="flex items-center justify-between py-0.5">
                <label className="text-[13.5px] text-[#54555f]">Concession (₹)</label>
                <input
                  type="number"
                  tabIndex={-1}
                  value={concession}
                  onChange={e => setConcession(Math.max(0, Math.min(total, parseFloat(e.target.value) || 0)))}
                  min={0} max={total}
                  className={cn("field !w-28 text-right tabular-nums !py-1.5", errors.concession && "!border-[#dc2626]")}
                />
              </div>
              {errors.concession && <p className="text-[12px] text-[#b91c1c] text-right">{errors.concession}</p>}
              <div className="border-t border-[#eef0f4] pt-2.5 mt-1">
                <BillRow label="Amount Received" value={`₹${net}`} bold />
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
