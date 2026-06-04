import { SessionProvider } from "@/components/layout/session-provider";

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
