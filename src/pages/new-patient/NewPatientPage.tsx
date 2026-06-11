import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listDoctors, upsertDoctor } from "@/lib/queries/doctors";
import { searchTests, listPanels } from "@/lib/queries/tests";
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
  const [received, setReceived] = useState(0);
  const [mode, setMode] = useState<PaymentMode>("CASH");

  // Test selection
  const [testQuery, setTestQuery] = useState("");
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [testDropdown, setTestDropdown] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: nextNo } = useQuery({ queryKey: ['next-test-no'], queryFn: getNextTestNo });
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: () => listDoctors() });
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
  const balance = Math.max(0, net - received);

  function addTest(test: Test) {
    if (selectedTests.find(t => t.test.id === test.id)) return;
    setSelectedTests(prev => [...prev, { test, price: test.price }]);
    setTestQuery("");
    setTestDropdown(false);
  }

  function removeTest(testId: number) {
    setSelectedTests(prev => prev.filter(t => t.test.id !== testId));
  }

  function addPanel(panelCode: string) {
    // Tests matching this panel are added from the search
    setTestQuery(panelCode);
    setTestDropdown(true);
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
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const prices: Record<number, number> = {};
      for (const st of selectedTests) prices[st.test.id] = st.price;

      const patientId = await createPatient({
        title, name: name.trim(), age: parseFloat(age), age_unit: ageUnit,
        sex, phone, email, address, doctor_id: doctorId,
        collected_at: collectedAt, sample_time: nowISO(),
        test_ids: selectedTests.map(t => t.test.id),
        prices, concession, received, mode,
      }, user!.id);

      qc.invalidateQueries({ queryKey: ['today-patients'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['next-test-no'] });

      if (andEnterResults) navigate(`/result-entry/${patientId}`);
      else navigate('/dashboard');
    } catch (err) {
      setErrors({ _: String(err) });
    } finally {
      setSaving(false);
    }
  }

  const quickPanels = ['CBC', 'LFT', 'KFT', 'LIPID', 'DIAB', 'URINE', 'THY', 'SERO'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Patient</h1>
          <p className="text-sm text-gray-500 mt-1">Test No: <span className="font-mono font-bold text-maroon-700">{testNo}</span></p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleSave(false)} disabled={saving}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
            Save & Close
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="flex items-center gap-2 bg-maroon-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-maroon-700 disabled:opacity-60">
            <Save size={15} />
            {saving ? 'Saving…' : 'Save & Enter Results ↵'}
          </button>
        </div>
      </div>

      {errors._ && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{errors._}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Patient details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Patient Details</h2>

          {/* Title + Name */}
          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <select value={title} onChange={e => setTitle(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                {['Mr.','Mrs.','Miss','Ms.','Master','Baby','Dr.','B/O'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="PATIENT NAME"
                className={cn("w-full px-3 py-2 border rounded-lg text-sm font-medium uppercase focus:outline-none focus:ring-2 focus:ring-maroon-500",
                  errors.name ? "border-red-400" : "border-gray-300")} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
          </div>

          {/* Age + Sex */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Age *</label>
              <div className="flex gap-2">
                <input type="number" value={age} onChange={e => setAge(e.target.value)} min="0" placeholder="Age"
                  className={cn("flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500",
                    errors.age ? "border-red-400" : "border-gray-300")} />
                <select value={ageUnit} onChange={e => setAgeUnit(e.target.value as AgeUnit)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                  <option>YRS</option><option>MTH</option><option>DAYS</option>
                </select>
              </div>
              {errors.age && <p className="text-xs text-red-500 mt-1">{errors.age}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sex</label>
              <div className="flex gap-1 border border-gray-300 rounded-lg p-1">
                {(['MALE','FEMALE','OTHER'] as Sex[]).map(s => (
                  <button key={s} onClick={() => setSex(s)}
                    className={cn("px-3 py-1 rounded text-xs font-medium transition-colors",
                      sex === s ? "bg-maroon-600 text-white" : "text-gray-600 hover:bg-gray-100")}>
                    {s === 'MALE' ? 'M' : s === 'FEMALE' ? 'F' : 'O'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Phone + Email */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone (WhatsApp)</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile"
                className={cn("w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500",
                  errors.phone ? "border-red-400" : "border-gray-300")} />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email (optional)</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
            </div>
          </div>

          {/* Doctor */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Referred By</label>
            <select value={doctorId ?? ''} onChange={e => setDoctorId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
              <option value="">— Select Doctor —</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
          </div>

          {/* Collected At */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Collected At</label>
            <input value={collectedAt} onChange={e => setCollectedAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
          </div>
        </div>

        {/* RIGHT: Tests + Billing */}
        <div className="space-y-4">
          {/* Test picker */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Tests</h2>

            {/* Quick panel chips */}
            <div className="flex flex-wrap gap-2">
              {quickPanels.map(p => (
                <button key={p} onClick={() => addPanel(p)}
                  className="px-3 py-1 bg-gray-100 hover:bg-maroon-50 hover:text-maroon-700 text-gray-700 rounded-full text-xs font-medium transition-colors border border-gray-200">
                  {p}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={testQuery} onChange={e => { setTestQuery(e.target.value); setTestDropdown(true); }}
                onFocus={() => setTestDropdown(true)}
                placeholder="Search tests by code or name…"
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
              {testDropdown && testResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {testResults.map(t => (
                    <button key={t.id} onClick={() => addTest(t)}
                      className="w-full text-left px-4 py-2 hover:bg-maroon-50 text-sm flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs text-gray-500 mr-2">{t.code}</span>
                        <span className="text-gray-900">{t.name}</span>
                      </div>
                      <span className="text-gray-500 text-xs">₹{t.price}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected tests */}
            {errors.tests && <p className="text-xs text-red-500">{errors.tests}</p>}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedTests.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No tests selected</p>
              ) : selectedTests.map(st => (
                <div key={st.test.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-mono text-xs text-gray-400 mr-2">{st.test.code}</span>
                    <span className="text-sm text-gray-900">{st.test.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="number" value={st.price} onChange={e => {
                      const p = parseFloat(e.target.value) || 0;
                      setSelectedTests(prev => prev.map(t => t.test.id === st.test.id ? { ...t, price: p } : t));
                    }} className="w-20 px-2 py-1 border border-gray-200 rounded text-sm tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-maroon-500" />
                    <button onClick={() => removeTest(st.test.id)} className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="font-semibold text-gray-900">Billing</h2>
            <BillRow label="Total" value={`₹${total}`} />
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Concession (₹)</label>
              <input type="number" value={concession} onChange={e => setConcession(parseFloat(e.target.value) || 0)}
                min={0} max={total}
                className={cn("w-28 px-2 py-1 border rounded text-sm tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-maroon-500",
                  errors.concession ? "border-red-400" : "border-gray-300")} />
            </div>
            {errors.concession && <p className="text-xs text-red-500">{errors.concession}</p>}
            <BillRow label="Net Payable" value={`₹${net}`} highlight />
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Received (₹)</label>
              <input type="number" value={received} onChange={e => setReceived(parseFloat(e.target.value) || 0)}
                min={0}
                className="w-28 px-2 py-1 border border-gray-300 rounded text-sm tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-maroon-500" />
            </div>
            <BillRow label="Balance" value={`₹${balance}`} highlight={balance > 0} danger={balance > 0} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
              <div className="flex gap-1">
                {(['CASH','UPI','CARD'] as PaymentMode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={cn("flex-1 py-1.5 rounded text-xs font-medium transition-colors border",
                      mode === m ? "bg-maroon-600 text-white border-maroon-600" : "text-gray-600 border-gray-200 hover:bg-gray-50")}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BillRow({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-sm", highlight ? "font-semibold text-gray-900" : "text-gray-600")}>{label}</span>
      <span className={cn("text-sm tabular-nums font-mono", highlight ? "font-bold" : "", danger ? "text-red-600" : "text-gray-900")}>{value}</span>
    </div>
  );
}
