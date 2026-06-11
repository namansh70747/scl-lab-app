import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertTest } from "@/lib/queries/tests";
import { Panel, ResultType, Test } from "@/types";
import { Modal } from "./Overlays";
import { Field, TextInput, Select, TextArea } from "./Fields";

const RESULT_TYPES: ResultType[] = ["numeric", "text", "choice", "calculated"];

export function AddTestDialog({
  panels,
  existingCodes,
  onClose,
  onDone,
  onError,
}: {
  panels: Panel[];
  existingCodes: Set<string>;
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [panelId, setPanelId] = useState<number | "">(panels[0]?.id ?? "");
  const [resultType, setResultType] = useState<ResultType>("numeric");
  const [unit, setUnit] = useState("");
  const [decimals, setDecimals] = useState("1");
  const [price, setPrice] = useState("0");
  const [defaultValue, setDefaultValue] = useState("");
  const [choices, setChoices] = useState("");
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

  const save = useMutation({
    mutationFn: (test: Partial<Test> & { code: string; name: string }) => upsertTest(test),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      onDone(`Test "${name.trim()}" added.`);
      onClose();
    },
    onError: (e: unknown) => onError(e instanceof Error ? e.message : "Failed to add test."),
  });

  function validate() {
    const next: { code?: string; name?: string } = {};
    const trimmedCode = code.trim();
    if (!trimmedCode) next.code = "Code is required.";
    else if (existingCodes.has(trimmedCode.toUpperCase())) next.code = "This code already exists.";
    if (!name.trim()) next.name = "Name is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    // For choice type, store choices as a JSON array string.
    let choicesJson: string | null = null;
    if (resultType === "choice") {
      const list = choices
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      choicesJson = list.length ? JSON.stringify(list) : null;
    }
    save.mutate({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      panel_id: panelId === "" ? undefined : Number(panelId),
      result_type: resultType,
      unit: unit.trim(),
      decimals: Number(decimals) || 0,
      price: Number(price) || 0,
      default_value: defaultValue.trim() || null,
      choices: choicesJson,
      enabled: 1,
      needs_review: 0,
    });
  }

  return (
    <Modal title="Add Test" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code *" error={errors.code} hint="Unique short code (uppercased).">
          <TextInput value={code} onChange={setCode} placeholder="e.g. HB" error={!!errors.code} />
        </Field>
        <Field label="Name *" error={errors.name}>
          <TextInput value={name} onChange={setName} placeholder="e.g. Hemoglobin" error={!!errors.name} />
        </Field>
        <Field label="Panel">
          <Select value={String(panelId)} onChange={(v) => setPanelId(v === "" ? "" : Number(v))}>
            <option value="">— None —</option>
            {panels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
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
          <TextInput value={unit} onChange={setUnit} placeholder="e.g. g/dl" />
        </Field>
        <Field label="Decimals">
          <TextInput value={decimals} onChange={setDecimals} type="number" numeric />
        </Field>
        <Field label="Price (₹)">
          <TextInput value={price} onChange={setPrice} type="number" numeric />
        </Field>
        <Field label="Default Value">
          <TextInput value={defaultValue} onChange={setDefaultValue} placeholder="Optional" />
        </Field>
        {resultType === "choice" && (
          <div className="col-span-2">
            <Field label="Choices" hint="Comma-separated, e.g. Positive, Negative, Trace">
              <TextArea value={choices} onChange={setChoices} rows={2} placeholder="Positive, Negative" />
            </Field>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className="btn btn-ghost">
          Cancel
        </button>
        <button onClick={handleSave} disabled={save.isPending} className="btn btn-primary">
          {save.isPending ? "Adding…" : "Add Test"}
        </button>
      </div>
    </Modal>
  );
}
