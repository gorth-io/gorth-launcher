import { Button } from "@/components/ui/button";
import {
  toast,
  useToasterSettings,
  type ToastPosition,
} from "@/providers/toaster";

export function ToastSettings() {
  const { position, setPosition } = useToasterSettings();
  const options: { value: ToastPosition; label: string }[] = [
    { value: "top-left", label: "Top left" },
    { value: "top-right", label: "Top right" },
    { value: "bottom-left", label: "Bottom left" },
    { value: "bottom-right", label: "Bottom right" },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Toast position</p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Toast position"
      >
        {options.map((option) => (
          <Button
            key={option.value}
            className="h-9"
            variant={position === option.value ? "default" : "outline"}
            aria-pressed={position === option.value}
            onClick={() => setPosition(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <Button
        className="h-9"
        variant="outline"
        onClick={() =>
          toast.add({
            title: "Preview notification",
            description: "Notifications appear in your selected corner.",
            type: "success",
          })
        }
      >
        Show toast
      </Button>
    </div>
  );
}
