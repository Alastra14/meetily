import React from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { VisuallyHidden } from "./ui/visually-hidden";
import { About } from "./About";

interface LogoProps {
    isCollapsed: boolean;
}

const Logo = React.forwardRef<HTMLButtonElement, LogoProps>(({ isCollapsed }, ref) => {
  return (
    <Dialog aria-describedby={undefined}>
      {isCollapsed ? (
        <DialogTrigger asChild>
          <button ref={ref} className="flex items-center justify-start mb-2 cursor-pointer bg-transparent border-none p-0 hover:opacity-80 transition-opacity">
            {/* T indigo en claro, T blanca en oscuro */}
            <Image src="/logo-collapsed.png" alt="Nova" width={26} height={38} className="dark:hidden" />
            <Image src="/logo-collapsed-dark.png" alt="Nova" width={26} height={38} className="hidden dark:block" />
          </button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <span className="text-lg text-center border rounded-full bg-blue-50 border-white font-semibold text-gray-700 mb-2 block items-center cursor-pointer hover:opacity-80 transition-opacity">
            <span>Nova</span>
          </span>
        </DialogTrigger>
      )}
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>About Nova</DialogTitle>
        </VisuallyHidden>
        <About />
      </DialogContent>
    </Dialog>
  );
});

Logo.displayName = "Logo";

export default Logo;