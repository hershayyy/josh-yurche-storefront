"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminError } from "@/lib/admin-error";
import { addCartLine, removeCartLine, updateCartLine } from "@/lib/cart";
import { createCartCheckout } from "@/lib/print-checkout";

export type CartFormState = { error?: string; added?: boolean } | null;

function refreshCart() {
  revalidatePath("/", "layout");
}

export async function addPrintToCart(
  _state: CartFormState,
  formData: FormData,
): Promise<CartFormState> {
  try {
    await addCartLine(formData);
    refreshCart();
    return { added: true };
  } catch (error) {
    if (!(error instanceof AdminError)) throw error;
    return { error: error.message };
  }
}

export async function changeCartQuantity(formData: FormData) {
  try {
    await updateCartLine(formData);
  } catch (error) {
    if (!(error instanceof AdminError)) throw error;
    redirect(`/cart?notice=${encodeURIComponent(error.message)}`);
  }

  refreshCart();
}

export async function removePrintFromCart(formData: FormData) {
  await removeCartLine(formData);
  refreshCart();
}

export async function startCartCheckout(
  _state: CartFormState,
  formData: FormData,
): Promise<CartFormState> {
  try {
    redirect(await createCartCheckout(formData));
  } catch (error) {
    if (!(error instanceof AdminError)) throw error;
    return { error: error.message };
  }
}
