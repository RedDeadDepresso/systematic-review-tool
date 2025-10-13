import { useState } from "react";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";

import { Button, buttonVariants } from "./ui/button";
import { Menu } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Link } from "@tanstack/react-router";
import { logout } from "@/api/auth";
import { LogOut } from "lucide-react";

interface RouteProps {
	href: string;
	label: string;
}

const routeList: RouteProps[] = [
	{
		href: "/login",
		label: "Login",
	},
	{
		href: "/register",
		label: "Register",
	},
];

export function Navbar() {
	const [isOpen, setIsOpen] = useState<boolean>(false);
	return (
		<header className="sticky border-b-[1px] top-0 z-40 w-full bg-white dark:border-b-slate-700 dark:bg-background mb-12">
			<NavigationMenu className="mx-auto">
				<NavigationMenuList className="container h-14 px-4 w-screen flex justify-between">
					<NavigationMenuItem className="font-bold flex gap-4">
						<Link rel="noreferrer noopener" to="/" className="font-bold text-xl m-auto">
							SLRT
						</Link>
						{/* desktop */}
						<nav className="hidden md:flex gap-2">
							{routeList.map((route: RouteProps, i) => (
								<Link
									to={route.href}
									key={i}
									className={`text-[17px] ${buttonVariants({
										variant: "ghost",
									})}`}
								>
									{route.label}
								</Link>
							))}
						</nav>
					</NavigationMenuItem>

					{/* mobile */}
					<span className="flex md:hidden">
						<ModeToggle />

						<Sheet open={isOpen} onOpenChange={setIsOpen}>
							<SheetTrigger className="px-2">
								<Menu className="flex md:hidden h-5 w-5" onClick={() => setIsOpen(true)}>
									<span className="sr-only">Menu Icon</span>
								</Menu>
							</SheetTrigger>

							<SheetContent side={"left"}>
								<SheetHeader>
									<SheetTitle className="font-bold text-xl">SLRT</SheetTitle>
								</SheetHeader>
								<nav className="flex flex-col justify-center items-center gap-2 mt-4">
									{routeList.map(({ href, label }: RouteProps) => (
										<Link key={label} to={href}>
											{label}
										</Link>
									))}
								</nav>
							</SheetContent>
						</Sheet>
					</span>

					<div className="hidden md:flex gap-2">
						<ModeToggle />
						<Button variant="outline" size="icon" onClick={logout} className="hover:text-red-500">
							<LogOut className="h-[1.2rem] w-[1.2rem" />
							<span className="sr-only">Log out</span>
						</Button>
					</div>
				</NavigationMenuList>
			</NavigationMenu>
		</header>
	);
}
