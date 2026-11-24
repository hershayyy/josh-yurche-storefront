import Link from "next/link";
import { connection } from "next/server";
import { cartCount } from "@/lib/cart";

export async function CartLink() {
  await connection();
  const count = await cartCount();
  const label = count > 0 ? `Cart (${count})` : "Cart";

  return (
    <Link href="/cart" className="text-sm underline-offset-4 hover:underline">
      {label}
    </Link>
  );
}
