import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTestRanges,
  upsertTest,
  setInterpretation,
  upsertRange,
  deleteRange,
} from "@/lib/queries/tests";
import { Panel, ResultType, Test, TestRange } from "@/types";
import { Sheet, ConfirmDialog } from "./Overlays";
import { Field, TextInput, Select, TextArea } from "./Fields";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Lock } from "lucide-react";

const RESULT_TYPES: ResultType[] = ["numeric", "text", "choice", "calculated"];
type Tab = "details" | "ranges" | "interpretation";

export function TestSheet({
  test,
  panels,
  canEditTests,
  canEditRanges,
  onClose,
  onSuccess,
  onError,
}: {
  test: Test;
  panels: Panel[];
  canEditTests: boolean;
  canEditRanges: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("details");

  return (
    <Sheet
      title={test.name}
      chip={test.code}
      subtitle={test.panel_code ?? undefined}
      onClose={onClose}
      header={
        <div className="flex gap-1 border-b border-[#f1efec] px-5 shrink-0">
          {(["details", "ranges", "interpretation"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-2.5 text-[13px] font-medium capitalize border-b-2 -mb-px transition-colors",
                tab === t
                  ? "border-maroon-600 text-[#1a1a1e]"
                  : "border-transparent text-[#8a857d] hover:text-[#5d5953]"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      {!canEditTests && (
        <div className="flex items-center gap-2 mb-4 rounded-lg bg-[#fdf0d7]/60 px-3 py-2 text-[12px] text-[#92600a]">
          <Lock size={13} strokeWidth={1.8} /> Read-only — editing requires Admin access.
        </div>
      )}
      {tab === "details" && (
        <DetailsTab
          test={test}
          panels={panels}
          canEdit={canEditTests}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
      {tab === "ranges" && (
        <RangesTab test={test} canEdit={canEditRanges} onSuccess={onSuccess} onError={onError} />
      )}
      {tab === "interpretation" && (
        <InterpretationTab test={test} canEdit={canEditTests} onSuccess={onSuccess} onError={onError} />
      )}
    </Sheet>
  );
}

function DetailsTab({
  test,
  panels,
  canEdit,
  onSuccess,
  onError,
}: {
  test: Test;
  panels: Panel[];
  canEdit: boolean;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(test.name);
  const [panelId, setPanelId] = useState<number | "">(test.panel_id ?? "");
  const [resultType, setResultType] = useState<ResultType>(test.result_type);
  const [unit, setUnit] = useState(test.unit ?? "");
  const [decimals, setDecimals] = useState(String(test.decimals ?? 0));
  const [price, setPrice] = useState(String(test.price ?? 0));
  const [sortOrder, setSortOrder] = useState(String(test.sort_order ?? 0));
  const [defaultValue, setDefaultValue] = useState(test.default_value ?? "");
  const [formula, setFormula] = useState(test.formula ?? "");
  const [choices, setChoices] = useState(() => {
    if (!test.choices) return "";
    try {
      const arr = JSON.parse(test.choices);
      return Array.isArray(arr) ? arr.join(", ") : test.choices;
    } catch {
      return test.choices;
    }
  });
  const [needsReview, setNeedsReview] = useState(!!test.needs_review);

  const save = useMutation({
    mutationFn: (t: Partial<Test> & { code: string; name: string }) => upsertTest(t),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      onSuccess("Test details saved.");
    },
    onError: (e: unknown) => onError(e instanceof Error ? e.message : "Failed to save."),
  });

  function handleSave() {
    let choicesJson: string | null = test.choices;
    if (resultType === "choice") {
      const list = choices.split(",").map((c) => c.trim()).filter(Boolean);
      choicesJson = list.length ? JSON.stringify(list) : null;
    }
    save.mutate({
      code: test.code,
      name: name.trim() || test.name,
      panel_id: panelId === "" ? undefined : Number(panelId),
      result_type: resultType,
      unit: unit.trim(),
      decimals: Number(decimals) || 0,
      price: Number(price) || 0,
      sort_order: Number(sortOrder) || 0,
      default_value: defaultValue.trim() || null,
      formula: formula.trim() || null,
      choices: choicesJson,
      enabled: test.enabled,
      is_panel: test.is_panel,
      interpretation_note: test.interpretation_note,
      needs_review: needsReview ? 1 : 0,
    });
  }

  return (
    <div className="space-y-4">
      <Field label="Code" hint="Code is the unique key and cannot be changed here.">
        <TextInput value={test.code} onChange={() => {}} disabled />
      </Field>
      <Field label="Name">
        <TextInput value={name} onChange={setName} disabled={!canEdit} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Panel">
          <Select value={String(panelId)} onChange={(v) => setPanelId(v === "" ? "" : Number(v))}>
            <option value="">— None —</option>
            {panels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Result Type">
          <Select value={resultType} onChange={(v) => setResultType(v as ResultType)}>
            {RESULT_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {rt}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit">
          <TextInput value={unit} onChange={setUnit} disabled={!canEdit} />
        </Field>
        <Field label="Decimals">
          <TextInput value={decimals} onChange={setDecimals} type="number" numeric disabled={!canEdit} />
        </Field>
        <Field label="Price (₹)">
          <TextInput value={price} onChange={setPrice} type="number" numeric disabled={!canEdit} />
        </Field>
        <Field label="Sort Order">
          <TextInput value={sortOrder} onChange={setSortOrder} type="number" numeric disabled={!canEdit} />
        </Field>
      </div>
      <Field label="Default Value">
        <TextInput value={defaultValue} onChange={setDefaultValue} disabled={!canEdit} />
      </Field>
      {resultType === "choice" && (
        <Field label="Choices" hint="Comma-separated list.">
          <TextArea value={choices} onChange={setChoices} rows={2} />
        </Field>
      )}
      {resultType === "calculated" && (
        <Field label="Formula" hint="Calculation expression.">
          <TextInput value={formula} onChange={setFormula} disabled={!canEdit} />
        </Field>
      )}
      <label className="flex items-center gap-2 text-[13px] text-[#5d5953] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={needsReview}
          disabled={!canEdit}
          onChange={(e) => setNeedsReview(e.target.checked)}
          className="rounded accent-maroon-600"
        />
        Needs review
      </label>

      {canEdit && (
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={save.isPending} className="btn btn-primary">
            {save.isPending ? "Saving…" : "Save Details"}
          </button>
        </div>
      )}
    </div>
  );
}

function sexChip(sex: TestRange["sex"]) {
  if (sex === "M") return { cls: "chip-blue", label: "M" };
  if (sex === "F") return { cls: "chip-red", label: "F" };
  return { cls: "chip-gray", label: "Any" };
}

function RangesTab({
  test,
  canEdit,
  onSuccess,
  onError,
}: {
  test: Test;
  canEdit: boolean;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const qc = useQueryClient();
  const { data: ranges = [], isLoading } = useQuery({
    queryKey: ["test-ranges", test.id],
    queryFn: () => getTestRanges(test.id),
  });

  const [confirmDel, setConfirmDel] = useState<TestRange | null>(null);

  // Add-range form state
  const [sex, setSex] = useState<"M" | "F" | "ANY">("ANY");
  const [ageMin, setAgeMin] = useState("0");
  const [ageMax, setAgeMax] = useState("36500");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [rangeText, setRangeText] = useState("");
  const [bandText, setBandText] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["test-ranges", test.id] });

  const add = useMutation({
    mutationFn: (r: Omit<TestRange, "id">) => upsertRange(r),
    onSuccess: () => {
      invalidate();
      onSuccess("Range added.");
      setLow("");
      setHigh("");
      setRangeText("");
      setBandText("");
    },
    onError: (e: unknown) => onError(e instanceof Error ? e.message : "Failed to add range."),
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteRange(id),
    onSuccess: () => {
      invalidate();
      onSuccess("Range deleted.");
      setConfirmDel(null);
    },
    onError: (e: unknown) => {
      onError(e instanceof Error ? e.message : "Failed to delete range.");
      setConfirmDel(null);
    },
  });

  function handleAdd() {
    add.mutate({
      test_id: test.id,
      sex,
      age_min_days: Number(ageMin) || 0,
      age_max_days: Number(ageMax) || 0,
      low: low.trim() === "" ? null : Number(low),
      high: high.trim() === "" ? null : Number(high),
      range_text: rangeText.trim() || null,
      band_text: bandText.trim() || null,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d] mb-3">
          Existing Ranges
        </p>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[#efedea]" />
            ))}
          </div>
        ) : ranges.length === 0 ? (
          <p className="text-[13.5px] text-[#8a857d] py-3">No reference ranges yet.</p>
        ) : (
          <div className="space-y-2">
            {ranges.map((r) => {
              const sc = sexChip(r.sex);
              return (
                <div
                  key={r.id}
                  className="group grid grid-cols-[auto_1fr_auto] items-start gap-x-3 rounded-xl border border-[#f1efec] bg-[#fcfbfa] px-3.5 py-2.5"
                >
                  <span className={cn("chip text-[10.5px] mt-0.5", sc.cls)}>{sc.label}</span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-[#1a1a1e] tabular-nums truncate">
                      {r.range_text || (
                        <>
                          {r.low ?? "—"} <span className="text-[#a8a29b] font-normal">–</span>{" "}
                          {r.high ?? "—"}
                        </>
                      )}
                    </div>
                    <div className="text-[11.5px] text-[#8a857d] tabular-nums mt-0.5">
                      {r.age_min_days}–{r.age_max_days} days
                    </div>
                    {r.band_text && (
                      <div className="text-[11.5px] text-[#8a857d] mt-0.5 truncate">{r.band_text}</div>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setConfirmDel(r)}
                      aria-label="Delete range"
                      className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-[#a8a29b] opacity-0 group-hover:opacity-100 hover:bg-[#fbe5e5] hover:text-[#a31e1e] transition-all"
                    >
                      <Trash2 size={15} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="rounded-xl border border-[#f1efec] p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d] mb-3">
            Add Range
          </p>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Sex">
              <Select value={sex} onChange={(v) => setSex(v as "M" | "F" | "ANY")}>
                <option value="ANY">Any</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </Select>
            </Field>
            <Field label="Age min (d)">
              <TextInput value={ageMin} onChange={setAgeMin} type="number" numeric />
            </Field>
            <Field label="Age max (d)">
              <TextInput value={ageMax} onChange={setAgeMax} type="number" numeric />
            </Field>
            <Field label="Low">
              <TextInput value={low} onChange={setLow} type="number" numeric placeholder="—" />
            </Field>
            <Field label="High">
              <TextInput value={high} onChange={setHigh} type="number" numeric placeholder="—" />
            </Field>
            <div className="col-span-3">
              <Field label="Range text" hint="Overrides low/high.">
                <TextInput value={rangeText} onChange={setRangeText} placeholder="e.g. < 40" />
              </Field>
            </div>
          </div>
          <Field label="Band text" hint="Multi-band / interpretation line (optional).">
            <TextInput value={bandText} onChange={setBandText} />
          </Field>
          <div className="flex justify-end">
            <button onClick={handleAdd} disabled={add.isPending} className="btn btn-primary">
              <Plus size={15} strokeWidth={2.2} /> {add.isPending ? "Adding…" : "Add Range"}
            </button>
          </div>
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          title="Delete range?"
          message={`This will permanently remove the ${
            confirmDel.sex === "ANY" ? "Any" : confirmDel.sex
          } range (${confirmDel.range_text || `${confirmDel.low ?? "—"}–${confirmDel.high ?? "—"}`}).`}
          confirmLabel="Delete"
          onConfirm={() => del.mutate(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

function InterpretationTab({
  test,
  canEdit,
  onSuccess,
  onError,
}: {
  test: Test;
  canEdit: boolean;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState(test.interpretation_note ?? "");

  // Keep local state in sync if the selected test changes.
  useEffect(() => {
    setNote(test.interpretation_note ?? "");
  }, [test.id, test.interpretation_note]);

  const save = useMutation({
    mutationFn: (n: string) => setInterpretation(test.id, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      onSuccess("Interpretation saved.");
    },
    onError: (e: unknown) => onError(e instanceof Error ? e.message : "Failed to save interpretation."),
  });

  return (
    <div className="space-y-4">
      <Field label="Interpretation note" hint="Free text printed beneath the results.">
        <TextArea
          value={note}
          onChange={setNote}
          rows={12}
          placeholder="Enter the printed interpretation / diagnosis note for this test…"
        />
      </Field>
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={() => save.mutate(note)} disabled={save.isPending} className="btn btn-primary">
            {save.isPending ? "Saving…" : "Save Interpretation"}
          </button>
        </div>
      )}
    </div>
  );
}
