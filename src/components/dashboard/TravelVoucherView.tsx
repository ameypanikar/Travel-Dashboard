import { useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import type { Flight, Hotel, Train, Bus, Expense, Advance, Allowance } from "@/lib/dashboard-api";
import {
  sumBookingInrMulti, sumExpensesByCategoryMulti, sumExpensesByPaymentMethodMulti, sumAdvancesMulti,
  sumBookingInr, sumExpensesByCategory, sumAdvances, formatInr,
  type TripParticipant,
  sumAllowancesMulti,
} from "@/lib/expense-utils";

function BoxField({
  label,
  value,
  onChange,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1 print:py-0.5">
      <span className="flex-1 text-[11px]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${wide ? "w-40" : "w-24"} rounded-none border border-black bg-transparent px-1.5 py-0.5 text-right text-[11px] outline-none`}
      />
    </div>
  );
}

export function TravelVoucherView({
  trip,
  participants,
  flights,
  hotels,
  trains,
  buses,
  expenses,
  advances,
  allowances,
  onClose,
}: {
  trip: string;
  participants: TripParticipant[];
  flights: Flight[];
  hotels: Hotel[];
  trains: Train[];
  buses: Bus[];
  expenses: Expense[];
  advances: Advance[];
  allowances: Allowance[];
  onClose: () => void;
}) {
  const airTickets = sumBookingInrMulti(flights as unknown as Record<string, string>[], "amount", trip, participants);
  const lodging = sumBookingInrMulti(hotels as unknown as Record<string, string>[], "bookedprice", trip, participants);
  const transportBusTrain =
    sumBookingInrMulti(trains as unknown as Record<string, string>[], "amount", trip, participants) +
    sumBookingInrMulti(buses as unknown as Record<string, string>[], "amount", trip, participants);

  const transportAutoTaxi = sumExpensesByCategoryMulti(expenses, trip, participants, "Transport (Auto/Taxi)");
  const food = sumExpensesByCategoryMulti(expenses, trip, participants, "Food");
  const petrolDiesel = sumExpensesByCategoryMulti(expenses, trip, participants, "Petrol/Diesel");
  const toll = sumExpensesByCategoryMulti(expenses, trip, participants, "Toll");
  const misc = sumExpensesByCategoryMulti(expenses, trip, participants, "Misc. Expenses");

  const cashTotal = sumExpensesByPaymentMethodMulti(expenses, trip, participants, ["Cash", "GPay"]);
  const cardTotal = sumExpensesByPaymentMethodMulti(expenses, trip, participants, ["Card"]);
  const advanceTotal = sumAdvancesMulti(advances, trip, participants);
  const allowanceTotal = sumAllowancesMulti(allowances, trip, participants);

  const [voucherNo, setVoucherNo] = useState(`V-${Date.now().toString().slice(-6)}`);
  const [date, setDate] = useState(new Date().toLocaleDateString("en-GB"));
  const [employeeNames, setEmployeeNames] = useState(participants.map((p) => p.username).join(", "));
  const [tourTo, setTourTo] = useState(trip);
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [cashExp, setCashExp] = useState(cashTotal.toFixed(2));
  const [cardExp, setCardExp] = useState(cardTotal.toFixed(2));
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [line3, setLine3] = useState("");
  const [advanceTaken, setAdvanceTaken] = useState(advanceTotal.toFixed(2));
  const [amountReturned, setAmountReturned] = useState("");
  const [airTicketsF, setAirTicketsF] = useState(airTickets.toFixed(2));
  const [lodgingF, setLodgingF] = useState(lodging.toFixed(2));
  const [transportBusTrainF, setTransportBusTrainF] = useState(transportBusTrain.toFixed(2));
  const [transportAutoF, setTransportAutoF] = useState(transportAutoTaxi.toFixed(2));
  const [foodF, setFoodF] = useState(food.toFixed(2));
  const [petrolF, setPetrolF] = useState(petrolDiesel.toFixed(2));
  const [tollF, setTollF] = useState(toll.toFixed(2));
  const [allowanceF, setAllowanceF] = useState(allowanceTotal.toFixed(2));
  const [miscF, setMiscF] = useState(misc.toFixed(2));
  const [amountSanctioned, setAmountSanctioned] = useState("");
  const [tourReport, setTourReport] = useState("");

  const totalExpenses = [airTicketsF, lodgingF, transportBusTrainF, transportAutoF, foodF, petrolF, tollF, allowanceF, miscF]
    .map((v) => parseFloat(v) || 0)
    .reduce((a, b) => a + b, 0);

  const breakdown = participants.map((p) => {
    const total = ["Food", "Transport (Auto/Taxi)", "Petrol/Diesel", "Toll", "Misc. Expenses"].reduce(
      (sum, cat) => sum + sumExpensesByCategory(expenses, trip, p.username, p.name, cat),
      0,
    );
    const bookingTotal =
      sumBookingInr(flights as unknown as Record<string, string>[], "amount", trip, p.username, p.name) +
      sumBookingInr(hotels as unknown as Record<string, string>[], "bookedprice", trip, p.username, p.name) +
      sumBookingInr(trains as unknown as Record<string, string>[], "amount", trip, p.username, p.name) +
      sumBookingInr(buses as unknown as Record<string, string>[], "amount", trip, p.username, p.name);
    const advance = sumAdvances(advances, trip, p.username, p.name);
    return { ...p, expenseTotal: total, bookingTotal, advance };
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div id="print-area" className="fixed inset-0 z-50 flex flex-col bg-background print:static print:h-auto print:overflow-visible print:bg-white print:text-black">
      <div className="flex items-center justify-between border-b px-4 py-3 print:hidden">
        <div className="text-sm font-bold">
          Travel Voucher — {trip}
          {participants.length > 1
            ? ` (combined, ${participants.length} employees)`
            : participants.length === 1
              ? ` — ${participants[0].username}`
              : ""}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
          >
            <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Pins a consistent A4 page box with tight margins so the browser's
          own default print margins (which vary and were pushing the
          "Authorised Signature" line onto a lone second page) don't apply. */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>

      <div className="flex-1 overflow-y-auto p-6 print:flex-none print:overflow-visible print:p-0">
        <div className="mx-auto max-w-2xl border-2 border-black bg-white p-4 text-black print:mx-0 print:max-w-none print:p-3 print:break-inside-avoid">
          <img
            src="/voucher-header.png"
            alt=""
            className="mb-2 w-full print:mb-1"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="mb-3 border-t border-black pt-2 text-center text-sm font-bold underline print:mb-1.5 print:pt-1">
            TRAVELLING EXPENSES FORM
          </div>

          <div className="grid grid-cols-2 gap-x-6 border-b border-black pb-2 print:pb-1">
            <BoxField label="Voucher No." value={voucherNo} onChange={setVoucherNo} />
            <BoxField label="Date" value={date} onChange={setDate} />
          </div>

          <div className="flex items-center gap-2 border-b border-black py-1.5 print:py-1">
            <span className="shrink-0 text-[11px]">Name of the Employee / Director :</span>
            <input
              value={employeeNames}
              onChange={(e) => setEmployeeNames(e.target.value)}
              className="flex-1 border-b border-black bg-transparent px-1 text-[11px] outline-none"
            />
          </div>

          <div className="flex items-center gap-2 border-b border-black py-1.5 print:py-1">
            <span className="shrink-0 text-[11px]">Tour To :</span>
            <input
              value={tourTo}
              onChange={(e) => setTourTo(e.target.value)}
              className="flex-1 border-b border-black bg-transparent px-1 text-[11px] outline-none"
            />
          </div>

          <div className="grid grid-cols-4 gap-x-3 border-b border-black py-1.5 text-[11px] print:py-1">
            <div className="col-span-1">Departure Date :</div>
            <input value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className="border-b border-black bg-transparent px-1 outline-none" />
            <div>Time :</div>
            <input value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className="border-b border-black bg-transparent px-1 outline-none" />
            <div className="col-span-1">Arrival Date :</div>
            <input value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className="border-b border-black bg-transparent px-1 outline-none" />
            <div>Time :</div>
            <input value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} className="border-b border-black bg-transparent px-1 outline-none" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-8 print:mt-2">
            <div>
              <BoxField label="Total Cash Exp. :" value={cashExp} onChange={setCashExp} />
              <BoxField label="Total Credit Card Exp. :" value={cardExp} onChange={setCardExp} />
              <BoxField label="1) ....................................." value={line1} onChange={setLine1} />
              <BoxField label="2) ....................................." value={line2} onChange={setLine2} />
              <BoxField label="3) ....................................." value={line3} onChange={setLine3} />
              <div className="mt-3 border-t border-black pt-2 print:mt-1.5 print:pt-1">
                <BoxField label="Advance Taken Rs. :" value={advanceTaken} onChange={setAdvanceTaken} />
                <BoxField label="Amount Returned / Received Rs. :" value={amountReturned} onChange={setAmountReturned} />
              </div>
            </div>
            <div>
              <BoxField label="• Air Tickets" value={airTicketsF} onChange={setAirTicketsF} />
              <BoxField label="• Lodging" value={lodgingF} onChange={setLodgingF} />
              <BoxField label="• Transport (Bus/Train)" value={transportBusTrainF} onChange={setTransportBusTrainF} />
              <BoxField label="• Transport (Auto/Taxi)" value={transportAutoF} onChange={setTransportAutoF} />
              <BoxField label="• Food" value={foodF} onChange={setFoodF} />
              <BoxField label="• Petrol/Diesel" value={petrolF} onChange={setPetrolF} />
              <BoxField label="• Toll" value={tollF} onChange={setTollF} />
              <BoxField label="• Allowance" value={allowanceF} onChange={setAllowanceF} />
              <BoxField label="• Misc. Expenses" value={miscF} onChange={setMiscF} />
              <div className="mt-2 flex items-center justify-end gap-2 border-t border-black pt-2 print:mt-1 print:pt-1">
                <span className="text-[11px] font-bold">Total Expenses Rs. :</span>
                <span className="w-24 border border-black px-1.5 py-0.5 text-right text-[11px] font-bold">
                  {totalExpenses.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-end justify-between print:mt-4">
            <div className="text-[11px]">
              _________________________<br />
              (Signature of Employee / Director)
            </div>
            <BoxField label="Amount Sanctioned Rs. :" value={amountSanctioned} onChange={setAmountSanctioned} wide />
          </div>

          <div className="mt-6 print:mt-3">
            <div className="mb-1 text-[11px]">Tour Report :</div>
            <textarea
              value={tourReport}
              onChange={(e) => setTourReport(e.target.value)}
              rows={3}
              className="w-full border-0 border-b border-black bg-transparent p-1 text-[11px] outline-none print:h-10 print:resize-none"
            />
          </div>

          <div className="mt-4 text-right text-[11px] print:mt-2">Authorised Signature</div>
        </div>

        <div className="mx-auto mt-6 max-w-2xl break-before-page bg-white p-4 text-black print:mx-0 print:max-w-none print:p-3 print:break-before-page print:text-black">
          <div className="mb-2 text-xs font-bold text-black print:text-black">Breakdown by employee — {trip}</div>
          <table className="w-full border border-black text-[11px] text-black">
            <thead>
              <tr className="border-b border-black">
                <th className="border-r border-black p-1 text-left">Employee</th>
                <th className="border-r border-black p-1 text-right">Bookings (Air/Lodging/Bus-Train)</th>
                <th className="border-r border-black p-1 text-right">Personal Expenses</th>
                <th className="p-1 text-right">Advance Given</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.username} className="border-b border-black last:border-0">
                  <td className="border-r border-black p-1">{b.username}</td>
                  <td className="border-r border-black p-1 text-right">{formatInr(b.bookingTotal)}</td>
                  <td className="border-r border-black p-1 text-right">{formatInr(b.expenseTotal)}</td>
                  <td className="p-1 text-right">{formatInr(b.advance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}