import { NavMain, NavMainUnauthenticated } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/hooks/useAuth";
import { BookOpenCheck } from "lucide-react";
import { NavTheme } from "./nav-theme";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { data, isLoading } = useCurrentUser();
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
							<span>
								<BookOpenCheck className="!size-5" />
								<span className="text-base font-semibold">SLRT</span>
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain />
			</SidebarContent>
			<SidebarFooter>
				<NavTheme />
				{!isLoading && <NavUser user={data} />}
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

export function AppSidebarUnauthenticated({
	...props
}: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
							<span>
								<BookOpenCheck className="!size-5" />
								<span className="text-base font-semibold">SLRT</span>
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMainUnauthenticated />
			</SidebarContent>
			<SidebarFooter>
				<NavTheme />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
