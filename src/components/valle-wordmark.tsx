import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const sizes: Record<
  Size,
  { main: string; sub: string }
> = {
  sm: {
    main: "text-xl font-extralight md:text-2xl",
    sub: "mt-1 text-[0.5rem] font-light tracking-[0.38em] md:text-[0.55rem] md:tracking-[0.42em]",
  },
  md: {
    main: "text-2xl font-extralight md:text-3xl",
    sub: "mt-1.5 text-[0.55rem] font-light tracking-[0.4em] md:text-xs md:tracking-[0.42em]",
  },
  lg: {
    main: "text-[1.875rem] font-extralight leading-none tracking-wide md:text-[2.375rem]",
    sub: "mt-2 text-[0.625rem] font-light tracking-[0.42em] md:text-[0.75rem] md:tracking-[0.45em]",
  },
};

/** Marca em tipografia castanha (sem imagem, fundo transparente). */
export function ValleWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: Size;
}) {
  const s = sizes[size];
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center text-primary",
        className
      )}
    >
      <span
        className={cn(
          "font-sans uppercase leading-none",
          s.main
        )}
      >
        Valle
      </span>
      <span className={cn("font-sans uppercase", s.sub)}>D&apos;incanto</span>
    </div>
  );
}
