import { useRef, useState } from "react";
import { Upload, Trash2, RefreshCw, Image as ImageIcon } from "lucide-react";
import { Card, TabHeader, SectionLabel, DangerGhostButton } from "../ui";
import { useSettingsForm } from "../useSettingsForm";
import { errMessage } from "../toast";

const KEYS = ["logo_data", "signature_data"];

export function BrandingTab({ settings }: { settings: Record<string, string> }) {
  const f = useSettingsForm(settings, KEYS);

  return (
    <Card className="space-y-6 animate-fade-up">
      <TabHeader title="Branding" subtitle="Logo and your father's signature image used on the printed report." />

      <ImagePicker
        title="Lab logo"
        description="Shown top-left of the report header."
        value={f.get("logo_data")}
        onPicked={async (dataUrl) => {
          if (await f.saveValue("logo_data", dataUrl)) f.toast.success("Logo updated.");
        }}
        onRemove={async () => {
          if (await f.saveValue("logo_data", "")) f.toast.success("Logo removed.");
        }}
        onError={(m) => f.toast.error(m)}
        saving={f.saving}
      />

      <div className="border-t border-[#eef0f4]" />

      <ImagePicker
        title="Father's signature"
        description="Printed above the “Lab Technician” line in the report footer."
        value={f.get("signature_data")}
        onPicked={async (dataUrl) => {
          if (await f.saveValue("signature_data", dataUrl)) f.toast.success("Signature updated.");
        }}
        onRemove={async () => {
          if (await f.saveValue("signature_data", "")) f.toast.success("Signature removed.");
        }}
        onError={(m) => f.toast.error(m)}
        saving={f.saving}
      />
    </Card>
  );
}

/** Subtle checkered backdrop so transparent images read clearly. */
const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #eef0f4 25%, transparent 25%), linear-gradient(-45deg, #eef0f4 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eef0f4 75%), linear-gradient(-45deg, transparent 75%, #eef0f4 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
};

function ImagePicker({
  title,
  description,
  value,
  onPicked,
  onRemove,
  onError,
  saving,
}: {
  title: string;
  description: string;
  value: string;
  onPicked: (dataUrl: string) => void;
  onRemove: () => void;
  onError: (msg: string) => void;
  saving: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") { onError("Could not read the image."); return; }
      // Downscale to a sensible max so a phone-camera logo doesn't bloat the database and slow
      // every report/PDF. Keeps aspect ratio; PNG preserves transparency for signatures.
      const img = new Image();
      img.onload = () => {
        const MAX = 480;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        if (scale >= 1) { onPicked(result); return; }   // already small enough
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { onPicked(result); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onPicked(canvas.toDataURL("image/png"));
      };
      img.onerror = () => onPicked(result);   // fall back to the original if decode fails
      img.src = result;
    };
    reader.onerror = () => onError(errMessage(reader.error) || "Could not read the image.");
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="text-[12px] text-[#a3a5b3] -mt-2 mb-3">{description}</div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {value ? (
        <div className="flex items-center gap-4 flex-wrap">
          <div
            className="w-36 h-24 rounded-xl border border-[#e6e7ee] flex items-center justify-center overflow-hidden shrink-0 p-2"
            style={CHECKER_STYLE}
          >
            <img src={value} alt={`${title} preview`} className="max-w-full max-h-full object-contain" />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              className="btn btn-ghost"
            >
              <RefreshCw size={15} strokeWidth={1.8} />
              Replace
            </button>
            <DangerGhostButton onClick={onRemove} disabled={saving}>
              <Trash2 size={15} strokeWidth={1.8} />
              Remove
            </DangerGhostButton>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={
            "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer " +
            (dragOver
              ? "border-maroon-400 bg-maroon-50/30"
              : "border-[#dcdde6] hover:border-maroon-400 hover:bg-maroon-50/30")
          }
        >
          <div className="w-11 h-11 rounded-xl bg-[#eef0f4] text-[#8a8b97] flex items-center justify-center mx-auto mb-3">
            <ImageIcon size={17} strokeWidth={1.8} />
          </div>
          <div className="text-[13.5px] text-[#54555f] font-medium inline-flex items-center gap-1.5">
            <Upload size={14} strokeWidth={1.8} />
            Click to upload, or drag an image here
          </div>
          <div className="text-[12px] text-[#a3a5b3] mt-1">PNG or JPG, transparent background works best</div>
        </div>
      )}
    </div>
  );
}
