import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTests, listPanels, upsertTest, updateTestPrice, setTestEnabled } from "@/lib/queries/tests";
import { Test } from "@/types";
import { useSession } from "@/lib/session";
import { FlaskConical, Search, Plus, Tags, Layers, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToastStack, useToasts } from "./Toast";
import { AddTestDialog } from "./AddTestDialog";
import { ManagePanelsDialog } from "./ManagePanelsDialog";
import { TestSheet } from "./TestSheet";

type EditField = "name" | "unit" | "price" | "decimals" | "sort_order";
interface EditingCell {
  id: number;
  field: EditField;
}

/** Borderless inline edit input — quiet underline, maroon when focused. */
const INLINE_INPUT =
  "bg-transparent border-0 border-b-[1.5px] border-[#d6d3cd] rounded-none px-0 py-0.5 text-[13.5px] text-[#1a1a1e] focus:border-maroon-600 focus:outline-none focus-visible:outline-none transition-colors";

export function TestMasterPage() {
  const qc = useQueryClient();
  const can = useSession((s) => s.can);
  const canEditTests = can("edit_tests");
  const canEditPrices = can("edit_prices");
  const canEditRanges = can("edit_ranges");

  const toast = useToasts();

  const [panelFilter, setPanelFilter] = useState<string>("ALL");
  const [searchQ, setSearchQ] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editVal, setEditVal] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showPanels, setShowPanels] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkPrices, setBulkPrices] = useState<Record<number, string>>({});

  const { data: panels = [] } = useQuery({ queryKey: ["panels"], queryFn: listPanels });
  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["tests", panelFilter],
    queryFn: () => listTests(panelFilter === "ALL" ? undefined : panelFilter, false),
  });
  // Unfiltered catalogue — shares the ["tests","ALL"] cache; powers the count
  // line and the per-panel badges in the rail regardless of the active filter.
  const { data: allTests = [] } = useQuery({
    queryKey: ["tests", "ALL"],
    queryFn: () => listTests(undefined, false),
  });

  const panelCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of allTests) {
      if (t.panel_code) m[t.panel_code] = (m[t.panel_code] ?? 0) + 1;
    }
    return m;
  }, [allTests]);

  const filtered = useMemo(
    () =>
      tests.filter((t) => {
        if (reviewOnly && !t.needs_review) return false;
        if (searchQ) {
          const q = searchQ.toLowerCase();
          if (!t.name.toLowerCase().includes(q) && !t.code.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [tests, reviewOnly, searchQ]
  );

  const reviewCount = useMemo(() => tests.filter((t) => t.needs_review).length, [tests]);
  // Check new codes against the FULL catalogue, not the panel-filtered view — otherwise a
  // code that exists in another panel passes the check and the ON CONFLICT upsert silently
  // overwrites that existing test.
  const existingCodes = useMemo(() => new Set(allTests.map((t) => t.code.toUpperCase())), [allTests]);

  const bulkChangedCount = useMemo(() => {
    let n = 0;
    for (const [id, raw] of Object.entries(bulkPrices)) {
      const t = tests.find((x) => x.id === Number(id));
      if (!t) continue;
      const price = parseFloat(raw);
      if (!Number.isNaN(price) && price !== t.price) n++;
    }
    return n;
  }, [bulkPrices, tests]);

  // Keep the open sheet's test object fresh after edits.
  const liveSelected = selectedTest ? tests.find((t) => t.id === selectedTest.id) ?? selectedTest : null;

  // ---- Mutations ----
  const savePrice = useMutation({
    mutationFn: ({ id, price }: { id: number; price: number }) => updateTestPrice(id, price),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      toast.success("Price updated.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update price."),
  });

  const saveField = useMutation({
    mutationFn: (t: Partial<Test> & { code: string; name: string }) => upsertTest(t),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      toast.success("Saved.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save."),
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: number }) => setTestEnabled(id, enabled),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      toast.success(vars.enabled ? "Test enabled." : "Test disabled.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to toggle test."),
  });

  const bulkSave = useMutation({
    mutationFn: async (changes: { id: number; price: number }[]) => {
      for (const c of changes) await updateTestPrice(c.id, c.price);
      return changes.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      toast.success(`${count} price${count === 1 ? "" : "s"} updated.`);
      setBulkMode(false);
      setBulkPrices({});
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Bulk price update failed."),
  });

  // ---- Inline edit helpers ----
  function beginEdit(t: Test, field: EditField) {
    if (!(field === "price" ? canEditPrices : canEditTests)) return;
    setEditing({ id: t.id, field });
    const raw =
      field === "name"
        ? t.name
        : field === "unit"
        ? t.unit ?? ""
        : field === "price"
        ? String(t.price)
        : field === "decimals"
        ? String(t.decimals)
        : String(t.sort_order);
    setEditVal(raw);
  }

  function commitEdit(t: Test) {
    if (!editing) return;
    const field = editing.field;
    if (field === "price") {
      const price = parseFloat(editVal);
      if (!Number.isNaN(price) && price !== t.price) savePrice.mutate({ id: t.id, price });
    } else if (field === "name") {
      const name = editVal.trim();
      if (name && name !== t.name) saveField.mutate(testPatch(t, { name }));
    } else if (field === "unit") {
      if (editVal !== (t.unit ?? "")) saveField.mutate(testPatch(t, { unit: editVal }));
    } else if (field === "decimals") {
      const decimals = parseInt(editVal, 10);
      if (!Number.isNaN(decimals) && decimals !== t.decimals) saveField.mutate(testPatch(t, { decimals }));
    } else if (field === "sort_order") {
      const sort_order = parseInt(editVal, 10);
      if (!Number.isNaN(sort_order) && sort_order !== t.sort_order)
        saveField.mutate(testPatch(t, { sort_order }));
    }
    setEditing(null);
  }

  function onEditKey(e: React.KeyboardEvent, t: Test) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit(t);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(null);
    }
  }

  function handleBulkSave() {
    const changes: { id: number; price: number }[] = [];
    for (const t of filtered) {
      const raw = bulkPrices[t.id];
      if (raw === undefined) continue;
      const price = parseFloat(raw);
      if (!Number.isNaN(price) && price !== t.price) changes.push({ id: t.id, price });
    }
    if (changes.length === 0) {
      toast.error("No price changes to save.");
      return;
    }
    bulkSave.mutate(changes);
  }

  function exitBulkMode() {
    setBulkMode(false);
    setBulkPrices({});
  }

  const readOnly = !canEditTests && !canEditPrices && !canEditRanges;

  return (
    <div className="pt-4 space-y-4 animate-fade-up">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[13px] text-[#8a857d] tabular-nums">
          {allTests.length} tests · {panels.length} panels
        </p>
        <div className="flex items-center gap-2">
          {canEditPrices && (
            <button
              onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
              className={cn(
                "btn btn-secondary",
                bulkMode && "border-amber-300 bg-[#fffbeb] text-[#92600a] hover:bg-[#fdf6dd] hover:border-amber-300"
              )}
            >
              <Tags size={15} strokeWidth={1.8} /> Bulk Price Edit
            </button>
          )}
          <button onClick={() => setShowPanels(true)} className="btn btn-ghost">
            <Layers size={15} strokeWidth={1.8} /> Manage Panels
          </button>
          {canEditTests && (
            <button onClick={() => setShowAdd(true)} className="btn btn-primary">
              <Plus size={15} strokeWidth={2.2} /> Add Test
            </button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-6">
        {/* Left rail */}
        <aside className="w-44 shrink-0">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a857d]">
            Panels
          </p>
          <nav className="space-y-px">
            <RailButton
              active={panelFilter === "ALL"}
              onClick={() => setPanelFilter("ALL")}
              label="All Tests"
              count={allTests.length}
            />
            {panels.map((p) => (
              <RailButton
                key={p.code}
                active={panelFilter === p.code}
                onClick={() => setPanelFilter(p.code)}
                label={p.code}
                count={panelCounts[p.code] ?? 0}
                title={p.name}
              />
            ))}
          </nav>

          <button
            onClick={() => setReviewOnly((v) => !v)}
            className={cn(
              "mt-4 mx-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
              reviewOnly
                ? "bg-[#fdf0d7] text-[#92600a]"
                : "text-[#8a857d] hover:bg-[#f1efec] hover:text-[#5d5953]"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                reviewOnly ? "bg-amber-500" : "bg-[#d6d3cd]"
              )}
            />
            Needs review
            <span className="text-[10.5px] tabular-nums">{reviewCount}</span>
          </button>
        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-4">
          {readOnly && (
            <div className="flex items-center gap-2 rounded-lg bg-[#fdf0d7]/60 px-3 py-2 text-[12.5px] text-[#92600a]">
              <Lock size={14} strokeWidth={1.8} /> You have read-only access. Editing requires Admin.
            </div>
          )}

          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search
                size={15}
                strokeWidth={1.8}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29b] pointer-events-none"
              />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search code or name…"
                className="field pl-9"
              />
            </div>
            <span className="text-[12px] text-[#a8a29b] tabular-nums">{filtered.length} shown</span>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f1efec]">
                  <th className="px-5 py-3 text-left table-head">Code</th>
                  <th className="px-5 py-3 text-left table-head">Name</th>
                  <th className="px-5 py-3 text-left table-head">Unit</th>
                  <th className="px-5 py-3 text-right table-head">Price ₹</th>
                  <th className="px-5 py-3 text-left table-head">Type</th>
                  <th className="px-5 py-3 text-left table-head">Panel</th>
                  <th className="px-5 py-3 text-center table-head">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-[#f6f5f3] last:border-0">
                      {[...Array(7)].map((__, j) => (
                        <td key={j} className="px-5 py-3">
                          <div className="h-4 animate-pulse rounded-lg bg-[#efedea]" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState reviewOnly={reviewOnly} searchQ={searchQ} />
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => {
                    const isEditing = (f: EditField) => editing?.id === t.id && editing.field === f;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTest(t)}
                        className={cn(
                          "group border-b border-[#f6f5f3] last:border-0 cursor-pointer transition-colors hover:bg-[#faf9f7]",
                          liveSelected?.id === t.id && "bg-maroon-50/60 hover:bg-maroon-50/60",
                          !t.enabled && "opacity-50"
                        )}
                      >
                        <td
                          className={cn(
                            "px-5 py-3 font-mono text-[12px] text-[#8a857d]",
                            !!t.needs_review && "shadow-[inset_2px_0_0_#f59e0b]"
                          )}
                        >
                          {t.code}
                        </td>

                        {/* Name */}
                        <CellEdit
                          editing={isEditing("name")}
                          canEdit={canEditTests}
                          onActivate={(e) => {
                            e.stopPropagation();
                            beginEdit(t, "name");
                          }}
                          display={
                            <span className="text-[14px] font-medium text-[#1a1a1e]">{t.name}</span>
                          }
                        >
                          <input
                            value={editVal}
                            autoFocus
                            onChange={(e) => setEditVal(e.target.value)}
                            onBlur={() => commitEdit(t)}
                            onKeyDown={(e) => onEditKey(e, t)}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(INLINE_INPUT, "w-full font-medium text-[14px]")}
                          />
                        </CellEdit>

                        {/* Unit */}
                        <CellEdit
                          editing={isEditing("unit")}
                          canEdit={canEditTests}
                          onActivate={(e) => {
                            e.stopPropagation();
                            beginEdit(t, "unit");
                          }}
                          display={
                            <span className="text-[12.5px] text-[#8a857d]">{t.unit || "—"}</span>
                          }
                        >
                          <input
                            value={editVal}
                            autoFocus
                            onChange={(e) => setEditVal(e.target.value)}
                            onBlur={() => commitEdit(t)}
                            onKeyDown={(e) => onEditKey(e, t)}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(INLINE_INPUT, "w-20")}
                          />
                        </CellEdit>

                        {/* Price */}
                        <td
                          className="px-5 py-3 text-right tabular-nums text-[13.5px]"
                          onClick={(e) => {
                            if (bulkMode) return;
                            e.stopPropagation();
                            beginEdit(t, "price");
                          }}
                        >
                          {bulkMode ? (
                            <input
                              type="number"
                              value={bulkPrices[t.id] ?? String(t.price)}
                              onChange={(e) =>
                                setBulkPrices((prev) => ({ ...prev, [t.id]: e.target.value }))
                              }
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                INLINE_INPUT,
                                "w-20 text-right tabular-nums",
                                bulkPrices[t.id] !== undefined &&
                                  parseFloat(bulkPrices[t.id]) !== t.price &&
                                  "border-amber-400 font-semibold text-[#92600a] focus:border-amber-500"
                              )}
                            />
                          ) : isEditing("price") ? (
                            <input
                              type="number"
                              value={editVal}
                              autoFocus
                              onChange={(e) => setEditVal(e.target.value)}
                              onBlur={() => commitEdit(t)}
                              onKeyDown={(e) => onEditKey(e, t)}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(INLINE_INPUT, "w-20 text-right tabular-nums")}
                            />
                          ) : (
                            <span
                              className={cn(
                                "text-[#1a1a1e]",
                                canEditPrices && "group-hover:text-maroon-700 transition-colors"
                              )}
                            >
                              ₹{t.price}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3">
                          <span className="chip chip-gray text-[10.5px] px-2 py-px capitalize">
                            {t.result_type}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-[11.5px] text-[#a8a29b]">
                          {t.panel_code ?? "—"}
                        </td>

                        {/* Enabled toggle */}
                        <td className="px-5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <MiniSwitch
                            on={!!t.enabled}
                            disabled={!canEditTests || toggleEnabled.isPending}
                            title={t.enabled ? "Disable test" : "Enable test"}
                            onToggle={() =>
                              toggleEnabled.mutate({ id: t.id, enabled: t.enabled ? 0 : 1 })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Bulk price action bar */}
            {bulkMode && (
              <div className="sticky bottom-0 bg-[#fffbeb] border-t border-amber-200 px-5 py-3 flex justify-between items-center">
                <span className="text-[13px] font-medium text-[#92600a] tabular-nums">
                  {bulkChangedCount} price{bulkChangedCount === 1 ? "" : "s"} changed
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={exitBulkMode} className="btn btn-ghost">
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkSave}
                    disabled={bulkSave.isPending}
                    className="btn btn-primary"
                  >
                    {bulkSave.isPending ? "Saving…" : "Save all"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sheet */}
      {liveSelected && (
        <TestSheet
          test={liveSelected}
          panels={panels}
          canEditTests={canEditTests}
          canEditRanges={canEditRanges}
          onClose={() => setSelectedTest(null)}
          onSuccess={toast.success}
          onError={toast.error}
        />
      )}

      {/* Dialogs */}
      {showAdd && (
        <AddTestDialog
          panels={panels}
          existingCodes={existingCodes}
          onClose={() => setShowAdd(false)}
          onDone={toast.success}
          onError={toast.error}
        />
      )}
      {showPanels && <ManagePanelsDialog panels={panels} onClose={() => setShowPanels(false)} />}

      <ToastStack toasts={toast.toasts} dismiss={toast.dismiss} />
    </div>
  );
}

function testPatch(t: Test, patch: Partial<Test>): Partial<Test> & { code: string; name: string } {
  return {
    code: t.code,
    name: t.name,
    panel_id: t.panel_id,
    result_type: t.result_type,
    unit: t.unit,
    decimals: t.decimals,
    price: t.price,
    enabled: t.enabled,
    sort_order: t.sort_order,
    choices: t.choices,
    default_value: t.default_value,
    formula: t.formula,
    interpretation_note: t.interpretation_note,
    is_panel: t.is_panel,
    needs_review: t.needs_review,
    ...patch,
  };
}

function RailButton({
  active,
  onClick,
  label,
  count,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "w-full flex items-center px-3 py-1.5 rounded-lg text-[13px] text-left transition-colors",
        active
          ? "bg-white shadow-[var(--shadow-card)] font-semibold text-[#1a1a1e]"
          : "text-[#5d5953] hover:bg-[#f1efec]"
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span className="text-[10.5px] text-[#a8a29b] tabular-nums ml-auto pl-2">{count}</span>
      )}
    </button>
  );
}

function MiniSwitch({
  on,
  disabled,
  title,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  title?: string;
  onToggle: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={title}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full transition-colors align-middle",
        on ? "bg-[#15803d]" : "bg-[#d6d3cd]",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        !disabled && !on && "hover:bg-[#c9c4bc]"
      )}
    >
      <span
        className={cn(
          "inline-block h-[13px] w-[13px] rounded-full bg-white shadow-[0_1px_2px_rgba(26,22,18,0.25)] transition-transform",
          on ? "translate-x-[14px]" : "translate-x-[2.5px]"
        )}
      />
    </button>
  );
}

function CellEdit({
  editing,
  canEdit,
  onActivate,
  display,
  children,
}: {
  editing: boolean;
  canEdit: boolean;
  onActivate: (e: React.MouseEvent) => void;
  display: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <td className="px-5 py-3" onClick={canEdit ? onActivate : undefined}>
      {editing ? children : display}
    </td>
  );
}

function EmptyState({ reviewOnly, searchQ }: { reviewOnly: boolean; searchQ: string }) {
  return (
    <div className="py-14 text-center">
      <div className="w-11 h-11 rounded-xl bg-[#f1efec] text-[#8a857d] flex items-center justify-center mx-auto mb-3">
        <FlaskConical size={17} strokeWidth={1.8} />
      </div>
      <p className="text-[13.5px] text-[#8a857d]">
        {searchQ
          ? "No tests match your search."
          : reviewOnly
          ? "No tests flagged for review."
          : "No tests in this panel."}
      </p>
      <p className="text-[12px] text-[#a8a29b] mt-1">
        {searchQ ? "Try a different code or name." : "Use “Add Test” to create one."}
      </p>
    </div>
  );
}
