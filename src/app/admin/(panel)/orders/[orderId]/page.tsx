import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PackageShipmentForm } from "@/components/admin/package-shipment-form";
import { PageTitle } from "@/components/page-shell";
import { requireAdmin } from "@/lib/admin-auth";
import { formatPrice } from "@/lib/artwork";
import {
  fulfillmentState,
  orderPackages,
  type OrderPackage,
} from "@/lib/order-packages";
import type { PackageTracking } from "@/lib/order-status";
import { getPaidOrder } from "@/lib/orders";
import { formatPrintChoice } from "@/lib/print-type";
import { isTestOrder } from "@/lib/sales";
import { packageRates } from "@/lib/shipping-rate";

export const metadata: Metadata = {
  title: "Paid order",
};

type OrderPageProps = {
  params: Promise<{ orderId: string }>;
};

const shippedDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function PaidOrderPage({ params }: OrderPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading paid order…</p>}>
      <OrderDetails params={params} />
    </Suspense>
  );
}

async function OrderDetails({ params }: OrderPageProps) {
  await connection();
  await requireAdmin();
  const { orderId } = await params;
  const order = await getPaidOrder(orderId);
  if (!order) notFound();

  const packages = orderPackages(order, packageRates());
  const tracking = order.packageTracking ?? [];
  const progress = fulfillmentState(packages, tracking);
  const pack = packages.filter((item) => item.fulfillment === "pack");
  const hold = packages.filter((item) => item.fulfillment === "hold");
  const address = order.shippingAddress;
  const titles = [
    ...new Set(packages.flatMap((item) => item.lines.map((line) => line.artworkTitle))),
  ];

  return (
    <>
      <Link
        href="/admin/orders"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        Paid orders
      </Link>
      <PageTitle>{titles.length === 1 ? titles[0] : "Print order"}</PageTitle>
      {isTestOrder(order) ? (
        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted">Test order</p>
      ) : null}
      <p className="mt-3 text-sm leading-6" role="status">
        {progress === "shipped"
          ? "Shipped"
          : progress === "partial"
            ? "Partly shipped"
            : "Not shipped"}
      </p>
      {order.shippingChoice === "ship-as-available" ? (
        <p className="mt-2 text-sm">Ship as available</p>
      ) : null}
      {order.shippingChoice === "wait-together" ? (
        <p className="mt-2 text-sm">Wait and ship together</p>
      ) : null}
      {pack.length > 0 ? (
        <PackageGroup
          heading="Pack"
          packages={pack}
          orderId={order.id}
          tracking={tracking}
          numbers={new Map(packages.map((item, index) => [item.id, index + 1]))}
        />
      ) : null}
      {hold.length > 0 ? (
        <PackageGroup
          heading="Hold"
          packages={hold}
          orderId={order.id}
          tracking={tracking}
          numbers={new Map(packages.map((item, index) => [item.id, index + 1]))}
        />
      ) : null}
      {order.email ? <p className="mt-6 text-sm">{order.email}</p> : null}
      <address className="mt-2 text-sm not-italic leading-6">
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
    </>
  );
}

function PackageGroup({
  heading,
  packages,
  orderId,
  tracking,
  numbers,
}: {
  heading: string;
  packages: OrderPackage[];
  orderId: string;
  tracking: PackageTracking[];
  numbers: Map<string, number>;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-[0.16em] text-muted">{heading}</h2>
      <ul className="mt-3 grid gap-6">
        {packages.map((item) => {
          const number = numbers.get(item.id) ?? 1;
          return (
            <PackageCard
              key={item.id}
              item={item}
              orderId={orderId}
              tracking={tracking.find((saved) => saved.packageId === item.id)}
              label={numbers.size > 1 ? `Package ${number}` : "Package"}
            />
          );
        })}
      </ul>
    </section>
  );
}

function PackageCard({
  item,
  orderId,
  tracking,
  label,
}: {
  item: OrderPackage;
  orderId: string;
  tracking?: PackageTracking;
  label: string;
}) {
  const timing =
    item.fulfillment === "pack" ? "Ready to ship" : item.shipWindow || "Ship window not set";

  return (
    <li className="min-w-0 border border-line px-4 py-4">
      <h3 className="text-sm">{label}</h3>
      <p className="mt-2 break-words text-sm leading-6">{timing}</p>
      <ul className="mt-3 grid gap-3 text-sm leading-6">
        {item.lines.map((line) => (
          <li key={`${line.artworkSlug}-${line.printId}-${line.quantity}`}>
            <p>{line.artworkTitle}</p>
            <p>
              {formatPrintChoice(line.printType, line.size)} · Qty {line.quantity}
            </p>
            <p>{line.kind === "in-stock" ? "Prints available" : "Open for pre-order"}</p>
            <p className="tabular-nums">
              {formatPrice((line.unitPriceCents * line.quantity) / 100)}
            </p>
          </li>
        ))}
      </ul>
      {tracking ? (
        <div className="mt-4 text-sm leading-6">
          <p>Shipped</p>
          <p>{tracking.carrier}</p>
          <p className="break-all">{tracking.trackingNumber}</p>
          <p className="text-muted">{shippedDate.format(new Date(tracking.shippedAt))} UTC</p>
        </div>
      ) : (
        <PackageShipmentForm orderId={orderId} packageId={item.id} />
      )}
    </li>
  );
}
