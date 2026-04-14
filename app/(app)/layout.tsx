import { Sidebar } from "@/components/nav/Sidebar";
import { PresentationWrapper } from "@/components/nav/PresentationWrapper";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PresentationWrapper>
      <div className="flex h-full">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </PresentationWrapper>
  );
}
