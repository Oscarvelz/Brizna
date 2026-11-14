import { Check, ChevronDown } from "lucide-react";
import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { PickerField } from "@/components/ui/picker-field";
import { useBackClose } from "@/lib/back-close";

const fieldClass =
  "h-12 w-full rounded-sm bg-surface px-3 text-fg shadow-card placeholder:text-subtle transition-[box-shadow] duration-150 focus:shadow-card-hover disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  if (props.type === "time" || props.type === "date") return <PickerField {...props} type={props.type as "time" | "date"} className={className} />;
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md bg-surface px-3 py-3 text-fg shadow-card placeholder:text-subtle transition-[box-shadow] duration-150 focus:shadow-card-hover",
        className,
      )}
      {...props}
    />
  );
}

function optionText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join("");
  if (isValidElement(node)) return optionText((node.props as { children?: ReactNode }).children);
  return "";
}

function readOptions(children: ReactNode) {
  const out: { value: string; label: string }[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: ReactNode };
    const label = optionText(props.children).trim();
    const value = props.value != null ? String(props.value) : label;
    out.push({ value, label: label || value });
  });
  return out;
}

export function NativeSelect({
  className,
  value,
  onChange,
  children,
  disabled,
  id,
  present,
  "aria-label": ariaLabel,
}: SelectHTMLAttributes<HTMLSelectElement> & { present?: string }) {
  const options = readOptions(children);
  const current = options.find((item) => item.value === String(value ?? "")) ?? options[0];
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useBackClose(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const box = root.current?.getBoundingClientRect();
    if (box) setUp(box.bottom + 280 > window.innerHeight && box.top > 280);
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: string) {
    setOpen(false);
    const event = { target: { value: next }, currentTarget: { value: next } } as ChangeEvent<HTMLSelectElement>;
    onChange?.(event);
  }

  return (
    <div
      ref={root}
      data-no-fold=""
      className="relative min-w-0"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        id={id}
        data-present={present}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        className={cn(fieldClass, "flex items-center justify-between gap-2 pr-3 text-left text-sm font-semibold", className)}
      >
        <span className="truncate">{current?.label ?? ""}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          role="listbox"
          className={cn(
            "absolute left-0 z-50 max-h-80 min-w-full w-max max-w-[min(22rem,calc(100vw-1.5rem))] overflow-auto rounded-md bg-surface py-1 shadow-card",
            up ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {options.map((item, index) => {
            const selected = item.value === String(value ?? current?.value ?? "");
            return (
              <li key={`${item.value}-${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(item.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm",
                    selected ? "bg-primary/10 font-semibold text-primary" : "text-fg active:bg-sun",
                  )}
                >
                  <span className="min-w-0">{item.label}</span>
                  {selected ? <Check className="size-4 shrink-0" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-muted", className)} {...props} />;
}
