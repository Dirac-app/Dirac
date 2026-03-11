import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  let session = null;
  try {
    session = await auth();
  } catch {
    // auth() may throw if env vars aren't set yet
  }

  // Not logged in → landing page
  if (!session?.user) {
    redirect("/home");
  }

  // Logged in but no account connected yet → onboarding
  if (!session.gmailConnected) {
    redirect("/onboarding");
  }

  // Fully connected → inbox
  redirect("/inbox");
}
