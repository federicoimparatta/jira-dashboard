import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const boardConfig = cookieStore.get("dash-board-config");

  // If boards are configured, go to dashboard; otherwise go to setup
  if (boardConfig?.value) {
    redirect("/dashboard");
  } else {
    redirect("/setup");
  }
}
