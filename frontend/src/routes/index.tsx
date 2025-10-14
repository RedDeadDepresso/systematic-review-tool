import { createFileRoute, redirect } from "@tanstack/react-router"
import { AppSidebar } from "@/components/app-sidebar"
import { DataTable } from "@/components/data-table"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

import { Separator } from "@/components/ui/separator"

export const Route = createFileRoute("/")({
	component: IndexPage,
	beforeLoad: async () => {
		const token = localStorage.getItem("access_token");
		if (!token) throw redirect({ to: "/login" });
	},
});

function IndexPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
			Home
          </div>
        </header>
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <DataTable data={[]} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
