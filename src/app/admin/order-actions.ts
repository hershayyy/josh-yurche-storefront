"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminError } from "@/lib/admin-error";
import { beginEmailClaim, shipmentNoticeKey } from "@/lib/order-email";
import {
  retryConfirmationEmail,
  retryShipmentEmail,
  sendShipmentEmail,
} from "@/lib/order-email-delivery";
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

    const packageId = String(formData.get("packageId") ?? "");
    const shippedAt = new Date().toISOString();
    const prepared: { claim: string; attempt: number } | null = { claim: "", attempt: 0 };
    let claimed = false;

    await updatePaidOrder(orderId, (current) => {
      const result = withPackageShipped(current, orderPackages(current, packageRates()), {
        packageId,
        carrier: String(formData.get("carrier") ?? ""),
        trackingNumber: String(formData.get("trackingNumber") ?? ""),
        shippedAt,
      });

      if (!result.ok) throw new AdminError(result.error);

      const email = beginEmailClaim(
        result.order.emailNotices,
        shipmentNoticeKey(packageId),
        "auto",
        shippedAt,
      );
      if (!email) return result.order;

      prepared.claim = email.claim;
      prepared.attempt = email.attempt;
      claimed = true;
      return { ...result.order, emailNotices: email.notices };
    });

    const saved = await getPaidOrder(orderId);
    if (saved && claimed) await sendShipmentEmail(saved, packageId, "auto", prepared);
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${orderId}`);
}

const PACKAGE_ID = /^(?:legacy|\d+:\d+)$/;

export async function retryOrderEmail(
  _state: ShipmentFormState,
  formData: FormData,
): Promise<ShipmentFormState> {
  const orderId = String(formData.get("orderId") ?? "");
  const packageId = String(formData.get("packageId") ?? "");

  try {
    await requireAdmin();

    if (packageId) {
      if (!PACKAGE_ID.test(packageId)) throw new AdminError("That package is not on this order.");
      await retryShipmentEmail(orderId, packageId);
    } else {
      await retryConfirmationEmail(orderId);
    }
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return null;
}
