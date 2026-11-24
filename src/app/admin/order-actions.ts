"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminError } from "@/lib/admin-error";
import { orderPackages, withPackageShipped } from "@/lib/order-packages";
import { getPaidOrder, updatePaidOrder } from "@/lib/orders";
import { packageRates } from "@/lib/shipping-rate";

export type ShipmentFormState = { error?: string } | null;

export async function markPackageShipped(
  _state: ShipmentFormState,
  formData: FormData,
): Promise<ShipmentFormState> {
  const orderId = String(formData.get("orderId") ?? "");

  try {
    await requireAdmin();
    const order = await getPaidOrder(orderId);
    if (!order) throw new AdminError("That paid order could not be found.");

    const packages = orderPackages(order, packageRates());
    const result = withPackageShipped(order, packages, {
      packageId: String(formData.get("packageId") ?? ""),
      carrier: String(formData.get("carrier") ?? ""),
      trackingNumber: String(formData.get("trackingNumber") ?? ""),
      shippedAt: new Date().toISOString(),
    });

    if (!result.ok) throw new AdminError(result.error);
    await updatePaidOrder(orderId, () => result.order);
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${orderId}`);
}
