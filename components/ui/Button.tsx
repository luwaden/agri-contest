import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "inverse";
const base = "inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px";
const variants: Record<Variant, string> = {
  primary: "bg-leaf-700 text-white hover:bg-leaf-800",
  secondary: "border border-neutral-300 bg-white text-forest-900 hover:border-leaf-600 hover:text-leaf-800",
  ghost: "text-leaf-800 hover:bg-leaf-50",
  inverse: "bg-white text-forest-900 hover:bg-leaf-50",
};

interface Common { variant?: Variant; className?: string; children: ReactNode }

export function Button({ variant = "primary", className = "", ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={`${base} ${variants[variant]} ${className}`} />;
}

export function LinkButton({ href, variant = "primary", className = "", children, ...rest }: Common & { href: string; "aria-disabled"?: boolean }) {
  return <Link href={href} {...rest} className={`${base} ${variants[variant]} ${className}`}>{children}</Link>;
}
