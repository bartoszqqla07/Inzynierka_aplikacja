import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import ConfirmDialog from "../components/ConfirmDialog";

const API = "http://localhost:5000";
const DAY_FIELDS = [
  { key: "mon", label: "Pn" },
  { key: "tue", label: "Wt" },
  { key: "wed", label: "Sr" },
  { key: "thu", label: "Cz" },
  { key: "fri", label: "Pt" },
  { key: "sat", label: "Sb" },
  { key: "sun", label: "Nd" },
];

const EMPTY_HOURS = DAY_FIELDS.reduce((acc, { key }) => {
  acc[key] = { open: false, from: "09:00", to: "17:00" };
  return acc;
}, {});

function toHoursForm(hoursValue) {
  if (!hoursValue || typeof hoursValue !== "object") return { ...EMPTY_HOURS };
  const form = { ...EMPTY_HOURS };
  DAY_FIELDS.forEach(({ key }) => {
    const slots = hoursValue[key];
    if (Array.isArray(slots) && slots.length > 0) {
      const first = slots[0];
      if (first?.from && first?.to) {
        form[key] = { open: true, from: first.from, to: first.to };
      }
    }
  });
  return form;
}

function toHoursPayload(hoursForm) {
  const result = {};
  DAY_FIELDS.forEach(({ key }) => {
    const day = hoursForm[key];
    if (day?.open && day.from && day.to) {
      result[key] = [{ from: day.from, to: day.to }];
    } else {
      result[key] = [];
    }
  });
  return result;
}

export default function AdminPanel() {
  const { session } = useAuth();
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem("admin.selectedSalonId");
    const parsed = stored ? Number(stored) : null;
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [form, setForm] = useState({
    name: "",
    city: "",
    description: "",
    address: "",
    phone: "",
    ownerEmail: "",
    hours: { ...EMPTY_HOURS },
  });
  const [newSalon, setNewSalon] = useState({
    name: "",
    city: "",
    description: "",
    address: "",
    phone: "",
    ownerEmail: "",
    hours: { ...EMPTY_HOURS },
  });
  const [serviceEdits, setServiceEdits] = useState({});
  const [newService, setNewService] = useState({ name: "", duration: "", price: "" });
  const [newImageFile, setNewImageFile] = useState(null);
  const [newImageMain, setNewImageMain] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [statsMonths, setStatsMonths] = useState("6");
  const [salonStats, setSalonStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [isDeleteSalonDialogOpen, setIsDeleteSalonDialogOpen] = useState(false);

  async function loadSalons() {
    if (!session) return;
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API}/admin/salons`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Blad pobierania salonow");
      const data = await res.json();
      setSalons(data);
      if (!data.length) {
        setSelectedId(null);
        return;
      }
      const storedRaw =
        typeof window !== "undefined"
          ? window.localStorage.getItem("admin.selectedSalonId")
          : null;
      const storedId = storedRaw ? Number(storedRaw) : null;
      const hasSelected = selectedId && data.some((s) => s.id === selectedId);
      const hasStored = storedId && data.some((s) => s.id === storedId);
      if (hasSelected) return;
      if (hasStored) {
        setSelectedId(storedId);
        return;
      }
      setSelectedId(data[0].id);
    } catch {
      setError("Nie udalo sie pobrac salonow.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSalons();
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedId) {
      window.localStorage.setItem("admin.selectedSalonId", String(selectedId));
    } else {
      window.localStorage.removeItem("admin.selectedSalonId");
    }
  }, [selectedId]);

  const selectedSalon = useMemo(
    () => salons.find((s) => s.id === selectedId),
    [salons, selectedId]
  );

  useEffect(() => {
    if (!selectedSalon) return;
    setForm({
      name: selectedSalon.name || "",
      city: selectedSalon.city || "",
      description: selectedSalon.description || "",
      address: selectedSalon.address || "",
      phone: selectedSalon.phone || "",
      ownerEmail: selectedSalon.owner?.email || "",
      hours: toHoursForm(selectedSalon.hours),
    });
    const edits = {};
    (selectedSalon.services || []).forEach((service) => {
      edits[service.id] = {
        name: service.name,
        duration: String(service.duration),
        price: String(service.price),
      };
    });
    setServiceEdits(edits);
  }, [selectedSalon]);

  useEffect(() => {
    if (!session || !selectedId || isCreateMode) {
      setSalonStats(null);
      setStatsError("");
      setStatsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadSalonStats() {
      try {
        setStatsLoading(true);
        setStatsError("");
        const res = await fetch(`${API}/admin/salons/${selectedId}/stats?months=${statsMonths}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!res.ok) throw new Error("Blad pobierania statystyk");
        const data = await res.json();
        if (isMounted) setSalonStats(data);
      } catch {
        if (isMounted) {
          setSalonStats(null);
          setStatsError("Nie udalo sie pobrac statystyk salonu.");
        }
      } finally {
        if (isMounted) setStatsLoading(false);
      }
    }

    loadSalonStats();

    return () => {
      isMounted = false;
    };
  }, [isCreateMode, selectedId, session, statsMonths]);

  async function updateSalon() {
    if (!selectedId || !session) return;
    setStatusMsg("");
    try {
      const payload = {
        name: form.name,
        city: form.city,
        description: form.description,
        address: form.address,
        phone: form.phone,
        ownerEmail: form.ownerEmail.trim() === "" ? null : form.ownerEmail.trim(),
        hours: toHoursPayload(form.hours),
      };

      const res = await fetch(`${API}/admin/salons/${selectedId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Update failed");
      setStatusMsg("Zapisano zmiany salonu.");
      await loadSalons();
    } catch {
      setStatusMsg("Blad zapisu danych salonu.");
    }
  }

  async function addSalon() {
    if (!session) return;
    setStatusMsg("");
    try {
      const payload = {
        name: newSalon.name.trim(),
        city: newSalon.city.trim(),
        description: newSalon.description.trim() || null,
        address: newSalon.address.trim() || null,
        phone: newSalon.phone.trim() || null,
        ownerEmail: newSalon.ownerEmail.trim() === "" ? null : newSalon.ownerEmail.trim(),
        hours: toHoursPayload(newSalon.hours),
      };
      if (!payload.name || !payload.city) {
        setStatusMsg("Uzupelnij nazwe i miasto nowego salonu.");
        return;
      }
      const res = await fetch(`${API}/admin/salons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const details = await res.json().catch(() => ({}));
        throw new Error(details?.error || "Blad tworzenia salonu");
      }
      const createdSalon = await res.json();
      setNewSalon({
        name: "",
        city: "",
        description: "",
        address: "",
        phone: "",
        ownerEmail: "",
        hours: { ...EMPTY_HOURS },
      });
      await loadSalons();
      if (createdSalon?.id) {
        setSelectedId(createdSalon.id);
      }
      setIsCreateMode(false);
      setStatusMsg("Dodano nowy salon.");
    } catch (err) {
      setStatusMsg(err?.message || "Blad tworzenia salonu.");
    }
  }

  async function deleteSalon() {
    if (!session || !selectedId || !selectedSalon) return;

    setStatusMsg("");
    try {
      const res = await fetch(`${API}/admin/salons/${selectedId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const details = await res.json().catch(() => ({}));
        throw new Error(details?.error || "Blad usuwania salonu");
      }
      setSelectedId(null);
      await loadSalons();
      setStatusMsg("Usunieto salon.");
    } catch (err) {
      setStatusMsg(err?.message || "Blad usuwania salonu.");
    }
  }

  async function addImageWithUrl(url) {
    if (!selectedId || !session || !url) return;
    setStatusMsg("");
    try {
      const res = await fetch(`${API}/admin/salons/${selectedId}/images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url, setAsMain: newImageMain }),
      });
      if (!res.ok) throw new Error("Add image failed");
      setNewImageFile(null);
      setNewImageMain(false);
      await loadSalons();
    } catch {
      setStatusMsg("Blad dodawania zdjecia.");
    }
  }

  const MAX_UPLOAD_BYTES = 40 * 1024;

  function estimateDataUrlBytes(dataUrl) {
    const base64 = dataUrl.split(",")[1] || "";
    return Math.ceil((base64.length * 3) / 4);
  }

  async function fileToJpegDataUrl(file) {
    const toDataUrl = async (maxSize, quality) => {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Blad odczytu pliku"));
        reader.readAsDataURL(file);
      });
      if (typeof dataUrl !== "string") {
        throw new Error("Niepoprawny format pliku");
      }

      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Blad wczytania obrazu"));
        image.src = dataUrl;
      });

      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Brak kontekstu canvas");
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", quality);
    };

    let maxSize = 1200;
    let quality = 0.8;
    let dataUrl = await toDataUrl(maxSize, quality);
    let bytes = estimateDataUrlBytes(dataUrl);

    while (bytes > MAX_UPLOAD_BYTES && maxSize > 400) {
      maxSize = Math.round(maxSize * 0.85);
      quality = Math.max(0.5, quality - 0.1);
      dataUrl = await toDataUrl(maxSize, quality);
      bytes = estimateDataUrlBytes(dataUrl);
    }

    if (bytes > MAX_UPLOAD_BYTES) {
      throw new Error(`Plik nadal za duzy po kompresji (${Math.round(bytes / 1024)} KB)`);
    }

    return dataUrl;
  }

  async function addImageFromFile() {
    if (!selectedId || !session || !newImageFile) return;
    setStatusMsg("");
    setIsUploading(true);
    try {
      const dataUrl = await fileToJpegDataUrl(newImageFile);
      await addImageWithUrl(dataUrl);
    } catch (err) {
      console.error("Upload error:", err);
      setStatusMsg("Blad zapisu zdjecia. Sprobuj mniejszy plik.");
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteImage(imageId) {
    if (!session) return;
    setStatusMsg("");
    try {
      const res = await fetch(`${API}/admin/images/${imageId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Delete image failed");
      await loadSalons();
    } catch {
      setStatusMsg("Blad usuwania zdjecia.");
    }
  }

  async function setMainImage(imageId) {
    if (!session || !selectedId) return;
    setStatusMsg("");
    try {
      const res = await fetch(`${API}/admin/salons/${selectedId}/main-image`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ imageId }),
      });
      if (!res.ok) throw new Error("Main image update failed");
      await loadSalons();
    } catch {
      setStatusMsg("Blad ustawiania zdjecia glownego.");
    }
  }

  async function addService() {
    if (!session || !selectedId) return;
    setStatusMsg("");
    try {
      const payload = {
        name: newService.name.trim(),
        duration: Number(newService.duration),
        price: Number(newService.price),
      };
      if (!payload.name || !payload.duration || !payload.price) {
        setStatusMsg("Uzupelnij dane nowej uslugi.");
        return;
      }
      const res = await fetch(`${API}/admin/salons/${selectedId}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Add service failed");
      setNewService({ name: "", duration: "", price: "" });
      await loadSalons();
    } catch {
      setStatusMsg("Blad dodawania uslugi.");
    }
  }

  async function updateService(serviceId) {
    if (!session) return;
    setStatusMsg("");
    const draft = serviceEdits[serviceId];
    if (!draft) return;
    try {
      const payload = {
        name: draft.name.trim(),
        duration: Number(draft.duration),
        price: Number(draft.price),
      };
      const res = await fetch(`${API}/admin/services/${serviceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Update service failed");
      await loadSalons();
    } catch {
      setStatusMsg("Blad zapisu uslugi.");
    }
  }

  async function deleteService(serviceId) {
    if (!session) return;
    setStatusMsg("");
    try {
      const res = await fetch(`${API}/admin/services/${serviceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Delete service failed");
      await loadSalons();
    } catch {
      setStatusMsg("Blad usuwania uslugi.");
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 text-center text-sm text-slate-600 shadow-sm">
        Ladowanie panelu admina...
      </div>
    );
  }

  const monthlyStats = salonStats?.monthly || [];
  const maxMonthlyCount = monthlyStats.reduce((acc, item) => Math.max(acc, item.count), 0);
  const currentMonthCount = salonStats?.bookingsThisMonth || 0;
  const previousMonthCount = salonStats?.bookingsPrevMonth || 0;
  const monthDelta = currentMonthCount - previousMonthCount;
  const monthDeltaPercent =
    previousMonthCount > 0 ? Math.round((monthDelta / previousMonthCount) * 100) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-slate-400">Salony</div>
        {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}
        <div className="mt-3 grid gap-2">
          {salons.map((salon) => (
            <button
              key={salon.id}
              type="button"
              onClick={() => {
                setIsCreateMode(false);
                setSelectedId(salon.id);
              }}
              className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                !isCreateMode && selectedId === salon.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-400"
              }`}
            >
              {salon.name}
              <div className="text-xs font-normal text-slate-400">{salon.city}</div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setIsCreateMode(true);
              setStatusMsg("");
            }}
            className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
              isCreateMode
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-400"
            }`}
          >
            + Dodaj salon
            <div className={`text-xs font-normal ${isCreateMode ? "text-slate-300" : "text-slate-400"}`}>
              Utworz nowy salon
            </div>
          </button>
        </div>
      </aside>

      <section className="space-y-6">
        {statusMsg && (
          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-3 text-xs text-slate-600 shadow-sm">
            {statusMsg}
          </div>
        )}
        {isCreateMode && (
        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Nowy salon</div>
              <h2 className="text-xl font-semibold text-slate-900">Dodaj salon</h2>
            </div>
            <button
              type="button"
              onClick={addSalon}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Dodaj salon
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              { label: "Nazwa", key: "name" },
              { label: "Miasto", key: "city" },
              { label: "Adres", key: "address" },
              { label: "Telefon", key: "phone" },
              { label: "Opis", key: "description" },
              { label: "Email wlasciciela", key: "ownerEmail" },
            ].map((field) => (
              <label key={`new-${field.key}`} className="grid gap-1 text-xs text-slate-500">
                {field.label}
                <input
                  value={newSalon[field.key]}
                  onChange={(e) =>
                    setNewSalon((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Godziny nowego salonu</div>
            <div className="grid gap-2">
              {DAY_FIELDS.map(({ key, label }) => {
                const day = newSalon.hours[key];
                return (
                  <div
                    key={`new-hours-${key}`}
                    className="grid items-center gap-2 rounded-xl border border-slate-200 bg-white/80 p-2 text-xs sm:grid-cols-[70px_1fr_1fr_1fr]"
                  >
                    <div className="font-semibold text-slate-700">{label}</div>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={day.open}
                        onChange={(e) =>
                          setNewSalon((prev) => ({
                            ...prev,
                            hours: {
                              ...prev.hours,
                              [key]: { ...prev.hours[key], open: e.target.checked },
                            },
                          }))
                        }
                      />
                      Otwarte
                    </label>
                    <input
                      type="time"
                      value={day.from}
                      disabled={!day.open}
                      onChange={(e) =>
                        setNewSalon((prev) => ({
                          ...prev,
                          hours: {
                            ...prev.hours,
                            [key]: { ...prev.hours[key], from: e.target.value },
                          },
                        }))
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    />
                    <input
                      type="time"
                      value={day.to}
                      disabled={!day.open}
                      onChange={(e) =>
                        setNewSalon((prev) => ({
                          ...prev,
                          hours: {
                            ...prev.hours,
                            [key]: { ...prev.hours[key], to: e.target.value },
                          },
                        }))
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {!isCreateMode && selectedSalon && (
        <>
        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Statystyki salonu</div>
              <h2 className="text-xl font-semibold text-slate-900">Rezerwacje miesieczne</h2>
            </div>
            <label className="grid gap-1 text-xs text-slate-500">
              Zakres
              <select
                value={statsMonths}
                onChange={(e) => setStatsMonths(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="3">3 miesiace</option>
                <option value="6">6 miesiecy</option>
                <option value="12">12 miesiecy</option>
              </select>
            </label>
          </div>

          {statsLoading ? (
            <div className="mt-3 text-sm text-slate-600">Ladowanie statystyk...</div>
          ) : null}
          {statsError ? <div className="mt-3 text-sm text-rose-600">{statsError}</div> : null}

          {!statsLoading && !statsError && salonStats ? (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                  <div className="text-xs text-slate-500">Lacznie w zakresie</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {salonStats.totalBookings}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                  <div className="text-xs text-slate-500">Biezacy miesiac</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {currentMonthCount}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                  <div className="text-xs text-slate-500">Zmiana m/m</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {monthDelta > 0 ? "+" : ""}
                    {monthDelta}
                    {monthDeltaPercent !== null ? ` (${monthDeltaPercent > 0 ? "+" : ""}${monthDeltaPercent}%)` : ""}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                  Liczba rezerwacji na miesiac
                </div>
                <div className="grid gap-2">
                  {monthlyStats.map((item) => {
                    const width =
                      maxMonthlyCount > 0 ? Math.max((item.count / maxMonthlyCount) * 100, item.count > 0 ? 6 : 0) : 0;
                    return (
                      <div key={item.month} className="grid items-center gap-2 sm:grid-cols-[72px_1fr_40px]">
                        <div className="text-xs text-slate-500">{item.label}</div>
                        <div className="h-3 rounded-full bg-slate-100">
                          <div
                            className="h-3 rounded-full bg-teal-500"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="text-right text-xs font-semibold text-slate-700">
                          {item.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                  Najczesciej rezerwowane uslugi
                </div>
                {salonStats.topServices?.length ? (
                  <div className="grid gap-2">
                    {salonStats.topServices.map((service) => (
                      <div
                        key={service.serviceId}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <span className="text-slate-700">{service.name}</span>
                        <span className="font-semibold text-slate-900">{service.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Brak rezerwacji dla wybranego zakresu.</div>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Dane salonu</div>
              <h1 className="text-xl font-semibold text-slate-900">{selectedSalon?.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteSalonDialogOpen(true)}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                Usun salon
              </button>
              <button
                type="button"
                onClick={updateSalon}
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
              >
                Zapisz
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              { label: "Nazwa", key: "name" },
              { label: "Miasto", key: "city" },
              { label: "Adres", key: "address" },
              { label: "Telefon", key: "phone" },
              { label: "Opis", key: "description" },
              { label: "Email wlasciciela", key: "ownerEmail" },
            ].map((field) => (
              <label key={field.key} className="grid gap-1 text-xs text-slate-500">
                {field.label}
                <input
                  value={form[field.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Godziny</div>
            <div className="grid gap-2">
              {DAY_FIELDS.map(({ key, label }) => {
                const day = form.hours[key];
                return (
                  <div
                    key={key}
                    className="grid items-center gap-2 rounded-xl border border-slate-200 bg-white/80 p-2 text-xs sm:grid-cols-[70px_1fr_1fr_1fr]"
                  >
                    <div className="font-semibold text-slate-700">{label}</div>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={day.open}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            hours: {
                              ...prev.hours,
                              [key]: { ...prev.hours[key], open: e.target.checked },
                            },
                          }))
                        }
                      />
                      Otwarte
                    </label>
                    <input
                      type="time"
                      value={day.from}
                      disabled={!day.open}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          hours: {
                            ...prev.hours,
                            [key]: { ...prev.hours[key], from: e.target.value },
                          },
                        }))
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    />
                    <input
                      type="time"
                      value={day.to}
                      disabled={!day.open}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          hours: {
                            ...prev.hours,
                            [key]: { ...prev.hours[key], to: e.target.value },
                          },
                        }))
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-400">Zdjecia</div>
          <div className="mt-3 grid gap-2">
            {selectedSalon?.images?.map((img) => (
              <div
                key={img.id}
                className="grid items-center gap-3 rounded-xl border border-slate-200 bg-white/80 p-2 text-xs sm:grid-cols-[72px_1fr_auto]"
              >
                <div className="h-16 w-18 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <img
                    src={img.url}
                    alt="Zdjecie salonu"
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0 text-slate-600">
                  <div className="truncate">{img.url}</div>
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    onClick={() => setMainImage(img.id)}
                    className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                      selectedSalon?.imageUrl === img.url
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                    disabled={selectedSalon?.imageUrl === img.url}
                  >
                    {selectedSalon?.imageUrl === img.url ? "Glowne" : "Ustaw glowne"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteImage(img.id)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                  >
                    Usun
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={newImageMain}
                onChange={(e) => setNewImageMain(e.target.checked)}
              />
              Ustaw glowne
            </label>
            <button
              type="button"
              onClick={addImageFromFile}
              disabled={!newImageFile || isUploading}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isUploading ? "Wgrywanie..." : "Wgraj JPG"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-400">Uslugi</div>
          <div className="mt-3 grid gap-2">
            {selectedSalon?.services?.map((service) => (
              <div key={service.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white/80 p-3 text-xs md:grid-cols-[2fr_1fr_1fr_auto_auto]">
                <input
                  value={serviceEdits[service.id]?.name || ""}
                  onChange={(e) =>
                    setServiceEdits((prev) => ({
                      ...prev,
                      [service.id]: { ...prev[service.id], name: e.target.value },
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                />
                <input
                  value={serviceEdits[service.id]?.duration || ""}
                  onChange={(e) =>
                    setServiceEdits((prev) => ({
                      ...prev,
                      [service.id]: { ...prev[service.id], duration: e.target.value },
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  placeholder="min"
                />
                <input
                  value={serviceEdits[service.id]?.price || ""}
                  onChange={(e) =>
                    setServiceEdits((prev) => ({
                      ...prev,
                      [service.id]: { ...prev[service.id], price: e.target.value },
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  placeholder="zl"
                />
                <button
                  type="button"
                  onClick={() => updateService(service.id)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                >
                  Zapisz
                </button>
                <button
                  type="button"
                  onClick={() => deleteService(service.id)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                >
                  Usun
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
            <input
              value={newService.name}
              onChange={(e) => setNewService((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nowa usluga"
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            />
            <input
              value={newService.duration}
              onChange={(e) => setNewService((prev) => ({ ...prev, duration: e.target.value }))}
              placeholder="min"
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            />
            <input
              value={newService.price}
              onChange={(e) => setNewService((prev) => ({ ...prev, price: e.target.value }))}
              placeholder="zl"
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={addService}
              className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-500"
            >
              Dodaj
            </button>
          </div>
        </div>
        </>
        )}

        {!isCreateMode && !selectedSalon && (
          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 text-sm text-slate-600 shadow-sm">
            Wybierz salon z listy po lewej albo kliknij "Dodaj salon".
          </div>
        )}
        <ConfirmDialog
          open={isDeleteSalonDialogOpen}
          title="Usunac salon?"
          message={
            selectedSalon
              ? `Czy na pewno chcesz usunac salon "${selectedSalon.name}"? Tej operacji nie mozna cofnac.`
              : "Czy na pewno chcesz usunac ten salon? Tej operacji nie mozna cofnac."
          }
          confirmText="Usun salon"
          cancelText="Anuluj"
          danger
          onCancel={() => setIsDeleteSalonDialogOpen(false)}
          onConfirm={async () => {
            setIsDeleteSalonDialogOpen(false);
            await deleteSalon();
          }}
        />
      </section>
    </div>
  );
}
