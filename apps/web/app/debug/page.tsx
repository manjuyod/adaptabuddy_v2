import { notFound } from "next/navigation";
import { DebugClient } from "./debug-client";

export default function DebugPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <DebugClient />;
}
