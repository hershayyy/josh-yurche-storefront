import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listPaidOrders } from "@/lib/orders";
import { parseSalesRange, salesCsv } from "@/lib/sales";

export async function GET(request: Request) {
  await connection();
  await requireAdmin();

  const url = new URL(request.url);
  const range = parseSalesRange(
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined,
  );
  const body = salesCsv(await listPaidOrders(), range);
  const filename =
    range.from || range.to
      ? `print-sales-${range.from ?? "start"}-to-${range.to ?? "latest"}.csv`
      : "print-sales.csv";

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
