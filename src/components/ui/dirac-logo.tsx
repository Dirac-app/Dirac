import Image from "next/image";
import { cn } from "@/lib/utils";

interface DiracLogoProps {
  /** Square logo size in px. */
  size?: number;
  className?: string;
  /** Invert for light backgrounds (white mark → dark). */
  invertOnLight?: boolean;
}

export function DiracLogo({
  size = 28,
  className,
  invertOnLight = false,
}: DiracLogoProps) {
  return (
    <Image
      src="/dirac-logo.png"
      alt="Dirac"
      width={size}
      height={size}
      className={cn(invertOnLight && "invert dark:invert-0", className)}
      priority
    />
  );
}
