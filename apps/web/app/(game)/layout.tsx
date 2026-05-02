import { NavigationBar } from "@/components/NavigationBar";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavigationBar />
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10 md:pb-10">{children}</div>
    </div>
  );
}
