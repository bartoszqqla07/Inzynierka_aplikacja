import { Link } from "react-router-dom";

const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22800%22%20height%3D%22480%22%20viewBox%3D%220%200%20800%20480%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23eef6f6%22/%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23e4f2ef%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22800%22%20height%3D%22480%22%20fill%3D%22url(%23g)%22/%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2232%22%20fill%3D%22%2394a3b8%22%3ENo%20image%3C/text%3E%3C/svg%3E";

export default function SalonCard({ salon }) {
  return (
    <div className="h-full w-[min(18rem,82vw)] shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 text-center shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md sm:w-72">
      <Link
        to={`/salons/${salon.id}`}
        className="flex h-full flex-col items-center gap-4 p-5 outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
      >
        <div className="min-w-0 text-center">
          <div className="text-lg font-semibold text-slate-900 truncate">{salon.name}</div>
          <div className="mt-1 text-sm text-slate-600">{salon.city}</div>
        </div>
        {salon.imageUrl && (
          <div className="h-36 w-full overflow-hidden rounded-2xl border border-slate-200/60">
            <img
              src={salon.imageUrl}
              alt={salon.name}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(event) => {
                if (event.currentTarget.src !== FALLBACK_IMAGE) {
                  event.currentTarget.src = FALLBACK_IMAGE;
                }
              }}
            />
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          {salon.services.map((s) => (
            <span
              key={s}
              className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-600"
            >
              {s}
            </span>
          ))}
        </div>
      </Link>
    </div>
  );
}
