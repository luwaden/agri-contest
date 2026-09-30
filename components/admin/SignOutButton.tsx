"use client";
import { useRouter } from "next/navigation";
export function SignOutButton() {
  const router = useRouter();
  return <button type="button" className="rounded px-2 py-1 font-semibold text-leaf-800 hover:underline" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/admin/login"); router.refresh(); }}>Sign out</button>;
}
