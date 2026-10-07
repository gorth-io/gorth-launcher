import { useRef } from "react";
import { useRanger } from "@tanstack/react-ranger";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
interface RangerProps {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  className?: string;
  onValueChange: (value: number) => void;
}
export function Ranger({
  id,
  label,
  min,
  max,
  value,
  step = 1,
  className,
  onValueChange,
}: RangerProps) {
  const track = useRef<HTMLDivElement>(null);
  const clamped = Math.max(min, Math.min(max, value));
  const ranger = useRanger<HTMLDivElement>({
    getRangerElement: () => track.current,
    min,
    max: Math.max(max, min + step),
    stepSize: step,
    values: [clamped],
    onChange: (instance) =>
      onValueChange(Math.max(min, Math.min(max, instance.sortedValues[0]))),
  });
  const handles = ranger.handles();
  const displayed = handles[0]?.value ?? clamped;
  return (
    <div className={cn("relative flex h-9 w-40 items-center px-4", className)}>
      <div ref={track} className="relative h-1 w-full rounded-full bg-muted">
        <div
          className="absolute h-full rounded-full bg-foreground"
          style={{ width: `${ranger.getPercentageForValue(displayed)}%` }}
        />
        {handles.map((handle, index) => (
          <Button
            key={index}
            id={id}
            type="button"
            variant="outline"
            size="icon"
            disabled={max <= min}
            className="absolute top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 touch-none rounded-md"
            style={{ left: `${ranger.getPercentageForValue(handle.value)}%` }}
            role="slider"
            aria-orientation="horizontal"
            aria-label={label}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={handle.value}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight")
                event.preventDefault();
              handle.onKeyDownHandler(event);
            }}
            onMouseDown={handle.onMouseDownHandler}
            onTouchStart={handle.onTouchStart}
          >
            <span className="h-3 w-px bg-foreground/50" />
          </Button>
        ))}
      </div>
    </div>
  );
}
