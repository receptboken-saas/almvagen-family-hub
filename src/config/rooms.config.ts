/**
 * Typed configuration template for rooms and Home Assistant entities at Almvägen 1.
 */

export type RoomFloor = "entréplan" | "övervåning" | "källare" | "utomhus";

export interface RoomEntityMapping {
  lights?: string[];
  temperatureSensor?: string;
  humiditySensor?: string;
  climate?: string;
  mediaPlayer?: string;
  covers?: string[];
}

export interface RoomConfig {
  id: string;
  name: string;
  floor: RoomFloor;
  icon: "sofa" | "utensils" | "bed" | "bath" | "car" | "trees" | "lamp";
  entities: RoomEntityMapping;
}

export const ROOMS_CONFIG: RoomConfig[] = [
  {
    id: "vardagsrum",
    name: "Vardagsrum",
    floor: "entréplan",
    icon: "sofa",
    entities: {
      lights: ["light.vardagsrum_tak", "light.vardagsrum_fonster"],
      temperatureSensor: "sensor.vardagsrum_temperatur",
      humiditySensor: "sensor.vardagsrum_luftfuktighet",
    },
  },
  {
    id: "kok",
    name: "Kök",
    floor: "entréplan",
    icon: "utensils",
    entities: {
      lights: ["light.kok_tak", "light.kok_bank"],
      temperatureSensor: "sensor.kok_temperatur",
    },
  },
  {
    id: "sovrum",
    name: "Sovrum",
    floor: "övervåning",
    icon: "bed",
    entities: {
      lights: ["light.sovrum_tak"],
      temperatureSensor: "sensor.sovrum_temperatur",
    },
  },
  {
    id: "garage",
    name: "Garage & Uppfart",
    floor: "utomhus",
    icon: "car",
    entities: {
      lights: ["light.garage_fasad"],
    },
  },
];
