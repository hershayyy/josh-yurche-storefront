import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageTitle } from "@/components/page-shell";
import { requireAdmin } from "@/lib/admin-auth";
import { formatPrice } from "@/lib/artwork";
import { fulfillmentState, orderPackages } from "@/lib/order-packages";
import type { OrderShipment, PrintOrder } from "@/lib/order-status";
import { listPaidOrders } from "@/lib/orders";
import { formatPrintChoice } from "@/lib/print-type";
import { isTestOrder, parseSalesRange, salesReport, type SalesTotals } from "@/lib/sales";
import { packageRates, type PackageRates } from "@/lib/shipping-rate";

export const metadata: Metadata = {
  title: "Paid orders",
};

const paidDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

type PaidOrdersPageProps = {
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
};

export default function PaidOrdersPage({ searchParams }: PaidOrdersPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading paid orders…</p>}>
      <PaidOrders searchParams={searchParams} />
    </Suspense>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function PaidOrders({ searchParams }: PaidOrdersPageProps) {
  await connection();
  await requireAdmin();
  const query = await searchParams;
  const range = parseSalesRange(one(query.from), one(query.to));
  const orders = await listPaidOrders();
  const rates = packageRates();
  const report = salesReport(orders, range);
  const exportQuery = new URLSearchParams();
  if (range.from) exportQuery.set("from", range.from);
  if (range.to) exportQuery.set("to", range.to);
  const exportHref = exportQuery.size
    ? `/admin/orders/export?${exportQuery.toString()}`
    : "/admin/orders/export";

  return (
    <>
      <PageTitle>Paid orders</PageTitle>
      <p className="mt-3 text-sm leading-6 text-muted">
        Only paid print orders are listed. Canceled and unfinished checkouts stay
        out of this queue.
      </p>
      <SalesSummary
        from={range.from ?? ""}
        to={range.to ?? ""}
        live={report.live}
        test={report.test}
        exportHref={exportHref}
      />
      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No paid orders yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {orders.map((order) => (
            <PaidOrder key={order.id} order={order} rates={rates} />
          ))}
        </ul>
      )}
    </>
  );
}

function SalesSummary({
  from,
  to,
  live,
  test,
  exportHref,
}: {
  from: string;
  to: string;
  live: SalesTotals;
  test: SalesTotals;
  exportHref: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-[0.16em] text-muted">Sales</h2>
      <form method="get" className="mt-3 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm" htmlFor="sales-from">
            From
            <input
              id="sales-from"
              name="from"
              type="date"
              defaultValue={from}
              className="mt-2 w-full border border-line bg-background px-3 py-3 text-base"
            />
          </label>
          <label className="text-sm" htmlFor="sales-to">
            To
            <input
              id="sales-to"
              name="to"
              type="date"
              defaultValue={to}
              className="mt-2 w-full border border-line bg-background px-3 py-3 text-base"
            />
          </label>
        </div>
        <p className="text-sm leading-6 text-muted">Dates use UTC, matching the paid time on each order.</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center border border-line px-4 text-sm"
          >
            Show sales
          </button>
          <Link
            href={exportHref}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Download CSV
          </Link>
        </div>
      </form>
      <p className="mt-4 text-sm leading-6 text-muted">
        The CSV is live sales for these dates, with one row per print line. Test
        orders and customer addresses are left out.
      </p>
      <Totals heading="Live sales" note="Test orders are not included." totals={live} />
      <Totals
        heading="Test orders"
        note="Stripe test mode. These totals stay out of live sales."
        totals={test}
      />
    </section>
  );
}

function Totals({
  heading,
  note,
  totals,
}: {
  heading: string;
  note: string;
  totals: SalesTotals;
}) {
  return (
    <section className="mt-6">
      <h3 className="font-serif text-xl tracking-tight">{heading}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{note}</p>
      <dl className="mt-3 grid gap-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt>Paid orders</dt>
          <dd className="tabular-nums">{totals.orderCount}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt>Prints sold</dt>
          <dd className="tabular-nums">{totals.printsSold}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt>Print sales</dt>
          <dd className="tabular-nums">{formatPrice(totals.printSalesCents / 100)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt>Shipping collected</dt>
          <dd className="tabular-nums">{formatPrice(totals.shippingCents / 100)}</dd>
        </div>
      </dl>
    </section>
  );
}

function PaidOrder({ order, rates }: { order: PrintOrder; rates: PackageRates | null }) {
  const address = order.shippingAddress;
  const shipments = order.shipments ?? [];
  const progress = fulfillmentState(orderPackages(order, rates), order.packageTracking ?? []);

  return (
    <li className="py-5 text-sm leading-6">
      {isTestOrder(order) ? (
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Test order</p>
      ) : null}
      {shipments.length > 0 ? (
        <ShipmentSummary order={order} shipments={shipments} />
      ) : (
        <>
          <p className="font-serif text-xl tracking-tight">{order.artworkTitle}</p>
          <p className="mt-2">{formatPrintChoice(order.printType, order.size)}</p>
          <p className="mt-1 tabular-nums">Print {formatPrice(order.unitPriceCents / 100)}</p>
          <p className="tabular-nums">Shipping {formatPrice(order.shippingCents / 100)}</p>
          <p className="tabular-nums">
            Order total {formatPrice((order.unitPriceCents + order.shippingCents) / 100)}
          </p>
          {order.shipWindow ? <p className="mt-1 break-words">{order.shipWindow}</p> : null}
        </>
      )}
      {progress === "shipped" ? <p className="mt-3">Shipped</p> : null}
      {progress === "partial" ? <p className="mt-3">Partly shipped</p> : null}
      <p className="mt-3 text-muted">
        {order.paidAt ? `${paidDate.format(new Date(order.paidAt))} UTC` : "Paid"}
      </p>
      <Link
        href={`/admin/orders/${order.id}`}
        className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
      >
        Open
      </Link>
      {order.email ? <p className="mt-3">{order.email}</p> : null}
      <address className="mt-1 not-italic">
        {address.name}
        <br />
        {address.line1}
        {address.line2 ? (
          <>
            <br />
            {address.line2}
          </>
        ) : null}
        <br />
        {address.city}, {address.state} {address.postalCode}
      </address>
    </li>
  );
}

function ShipmentSummary({
  order,
  shipments,
}: {
  order: PrintOrder;
  shipments: OrderShipment[];
}) {
  const titles = [...new Set(shipments.flatMap((shipment) => shipment.lines.map((line) => line.artworkTitle)))];
  const pack = shipments.filter((shipment) => shipment.fulfillment === "pack");
  const hold = shipments.filter((shipment) => shipment.fulfillment === "hold");
  const showGroupCharge = shipments.length > 1;
  const merchandiseCents = shipments.reduce(
    (sum, shipment) =>
      sum +
      shipment.lines.reduce((lineSum, line) => lineSum + line.unitPriceCents * line.quantity, 0),
    0,
  );

  return (
    <>
      <p className="font-serif text-xl tracking-tight">
        {titles.length === 1 ? titles[0] : "Print order"}
      </p>
      {order.shippingChoice === "ship-as-available" ? (
        <p className="mt-2">Ship as available</p>
      ) : null}
      {order.shippingChoice === "wait-together" ? (
        <p className="mt-2">Wait and ship together</p>
      ) : null}
      {pack.length > 0 ? (
        <section className="mt-4">
          <h2 className="text-xs uppercase tracking-[0.16em] text-muted">Pack</h2>
          {pack.map((shipment, index) => (
            <ShipmentBlock
              key={`pack-${index}`}
              shipment={shipment}
              waitTogether={order.shippingChoice === "wait-together"}
              showCharge={showGroupCharge}
            />
          ))}
        </section>
      ) : null}
      {hold.length > 0 ? (
        <section className="mt-4">
          <h2 className="text-xs uppercase tracking-[0.16em] text-muted">Hold</h2>
          {hold.map((shipment, index) => (
            <ShipmentBlock
              key={`hold-${index}`}
              shipment={shipment}
              waitTogether={order.shippingChoice === "wait-together"}
              showCharge={showGroupCharge}
            />
          ))}
        </section>
      ) : null}
      <p className="mt-3 tabular-nums">Shipping {formatPrice(order.shippingCents / 100)}</p>
      <p className="tabular-nums">
        Order total {formatPrice((merchandiseCents + order.shippingCents) / 100)}
      </p>
    </>
  );
}

function ShipmentBlock({
  shipment,
  waitTogether,
  showCharge,
}: {
  shipment: OrderShipment;
  waitTogether: boolean;
  showCharge: boolean;
}) {
  const timing = waitTogether
    ? "Ships together when every pre-order is ready"
    : shipment.fulfillment === "pack"
      ? "Ready to ship"
      : shipment.shipWindow || "Ship window not set";

  return (
    <div className="mt-3 min-w-0">
      <p className="break-words">{timing}</p>
      {waitTogether && shipment.shipWindow ? (
        <p className="break-words">{shipment.shipWindow}</p>
      ) : null}
      <ul className="mt-2 grid gap-3">
        {shipment.lines.map((line) => (
          <li key={`${line.artworkSlug}-${line.printId}`}>
            <p>{line.artworkTitle}</p>
            <p>
              {formatPrintChoice(line.printType, line.size)} · Qty {line.quantity}
            </p>
            <p>{line.kind === "in-stock" ? "Prints available" : "Open for pre-order"}</p>
            {line.shipWindow && line.shipWindow !== shipment.shipWindow ? (
              <p className="break-words">{line.shipWindow}</p>
            ) : null}
            <p className="tabular-nums">
              {formatPrice((line.unitPriceCents * line.quantity) / 100)}
            </p>
          </li>
        ))}
      </ul>
      {showCharge ? (
        <p className="mt-2 tabular-nums">
          Shipping {formatPrice(shipment.shippingCents / 100)}
        </p>
      ) : null}
    </div>
  );
}
