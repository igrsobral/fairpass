"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

const toCents = (v: string) => Math.round(parseFloat(v) * 100);

function fieldClass(accent?: boolean) {
  return accent
    ? "input border-amber-300 bg-amber-50/40 focus:border-amber-500 focus:ring-amber-500/15"
    : "input";
}

export function SellForm() {
  const router = useRouter();
  const [eventId, setEventId] = useState("");
  const [dateId, setDateId] = useState("");
  const [section, setSection] = useState("");
  const [row, setRow] = useState("");
  const [seat, setSeat] = useState("");
  const [tier, setTier] = useState<"premium" | "standard" | "budget">("standard");
  const [faceValue, setFaceValue] = useState("");
  const [price, setPrice] = useState("");
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const events = trpc.events.list.useQuery();
  const dates = trpc.events.dates.useQuery({ eventId }, { enabled: !!eventId });
  const create = trpc.listings.create.useMutation({
    onSuccess: () => {
      router.push("/account");
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });

  const faceCents = toCents(faceValue);
  const priceCents = toCents(price);
  const deviation =
    faceCents > 0 && priceCents > 0
      ? Math.round(((priceCents - faceCents) / faceCents) * 100)
      : null;

  return (
    <form
      className="card flex flex-col gap-4 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        create.mutate({
          eventDateId: dateId,
          section: section.trim() || null,
          row: row.trim() || null,
          seat: seat.trim() || null,
          tier,
          faceValueCents: toCents(faceValue),
          priceCents: toCents(price),
          barcode: barcode.trim() || null,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="event" className="label">
            Event
          </label>
          <select
            id="event"
            className="input"
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setDateId("");
            }}
            required
          >
            <option value="">Select an event…</option>
            {events.data?.map((row) => (
              <option key={row.event.id} value={row.event.id}>
                {row.event.title} — {row.city ?? "TBA"}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="date" className="label">
            Event date
          </label>
          <select
            id="date"
            className="input"
            value={dateId}
            onChange={(e) => setDateId(e.target.value)}
            required
            disabled={!eventId}
          >
            <option value="">
              {eventId ? "Select a date…" : "Choose an event first"}
            </option>
            {dates.data?.map((date) => (
              <option key={date.id} value={date.id}>
                {new Date(date.startsAt).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tier" className="label">
            Tier
          </label>
          <select id="tier" className="input" value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
            <option value="premium">Premium</option>
            <option value="standard">Standard</option>
            <option value="budget">Budget</option>
          </select>
        </div>
        <div>
          <label htmlFor="section" className="label">
            Section
          </label>
          <input
            id="section"
            className="input"
            placeholder="Floor"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="row" className="label">
            Row
          </label>
          <input id="row" className="input" placeholder="12" value={row} onChange={(e) => setRow(e.target.value)} />
        </div>
        <div>
          <label htmlFor="seat" className="label">
            Seat
          </label>
          <input id="seat" className="input" placeholder="4" value={seat} onChange={(e) => setSeat(e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border border-white/60 bg-white/40 shadow-glass backdrop-blur-xl p-4">
        <p className="label mb-3">Pricing</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="face" className="label">
              Face value (USD)
            </label>
            <input
              id="face"
              type="number"
              min="0.01"
              step="0.01"
              className={inputField(faceCents, priceCents)}
              placeholder="90.00"
              value={faceValue}
              onChange={(e) => setFaceValue(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="price" className="label">
              Asking price (USD)
            </label>
            <input
              id="price"
              type="number"
              min="0.01"
              step="0.01"
              className={inputField(faceCents, priceCents)}
              placeholder="99.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
        </div>
        {deviation != null && (
          <p
            className={`chip mt-3 ${
              deviation <= 15
                ? "bg-emerald-500/10 text-emerald-700"
                : deviation <= 50
                  ? "bg-amber-500/10 text-amber-700"
                  : "bg-red-500/10 text-red-700"
            }`}
          >
            {deviation > 0 ? `+${deviation}% vs face — ` : `${deviation}% vs face — `}
            {deviation <= 15
              ? "Fair price"
              : deviation <= 50
                ? "Moderate markup"
                : "Marked up — may be flagged as scalped"}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="barcode" className="label">
          Barcode <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <input
          id="barcode"
          className="input"
          placeholder="4006381333931"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-zinc-400">
          Stored as a SHA-256 hash; verified by the platform before payout.
        </p>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={create.isPending || !dateId}
        className="btn-primary mt-1"
      >
        {create.isPending ? "Listing…" : "List tickets"}
      </button>
    </form>
  );
}

function inputField(faceCents: number, priceCents: number) {
  const overpriced = faceCents > 0 && priceCents > faceCents * 1.5;
  return overpriced ? fieldClass(true) : "input";
}