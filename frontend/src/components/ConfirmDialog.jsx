export default function ConfirmDialog({
  open,
  title = "Potwierdzenie",
  message = "",
  confirmText = "Potwierdz",
  cancelText = "Anuluj",
  onConfirm,
  onCancel,
  confirmDisabled = false,
  danger = false,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-transparent" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              danger ? "bg-rose-600 hover:bg-rose-500" : "bg-teal-600 hover:bg-teal-500"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
