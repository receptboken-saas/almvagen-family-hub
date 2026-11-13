import {
  Bath,
  Bed,
  Car,
  Coins,
  Flame,
  Home,
  Lamp,
  Layers,
  Lightbulb,
  PlugZap,
  Shield,
  Sofa,
  Sparkles,
  Thermometer,
  Trees,
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  flame: Flame,
  "plug-zap": PlugZap,
  coins: Coins,
  thermometer: Thermometer,
  shield: Shield,
  sparkles: Sparkles,
  home: Home,
  layers: Layers,
  sofa: Sofa,
  utensils: Utensils,
  bed: Bed,
  bath: Bath,
  car: Car,
  trees: Trees,
  lamp: Lamp,
  lightbulb: Lightbulb,
};

interface DynamicIconProps {
  name?: string | null;
  className?: string;
}

export function DynamicIcon({ name, className = "h-5 w-5" }: DynamicIconProps) {
  const key = (name ?? "").toLowerCase().trim();
  const Icon = ICON_MAP[key] ?? Home;
  return <Icon className={className} aria-hidden="true" />;
}
