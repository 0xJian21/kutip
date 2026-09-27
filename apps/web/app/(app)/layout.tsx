import { SideNav, TopBar } from "@/components/shell/nav";
import { ownerData } from "@/lib/server/data";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const data = await ownerData();
  const exporter = await data.getExporter();
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <SideNav exporterName={exporter.name} ownerName={exporter.ownerName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar exporterName={exporter.name} ownerName={exporter.ownerName} />
        <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
