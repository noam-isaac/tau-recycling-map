import { RecyclingMapApp } from "@/RecyclingMapApp";
import catalogJson from "@/data/recycling-locations.json";
import type { RecyclingCatalog } from "@/data/types";

const catalog: RecyclingCatalog = catalogJson;

export default function App() {
  return <RecyclingMapApp catalog={catalog} />;
}
