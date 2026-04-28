import { Link } from "react-router-dom";
import { createPageUrl } from "../lib/pages";

const tiles = [
  {
    label: "WOMEN",
    category: "Women",
    image: "/categories/women.jpg",
  },
  {
    label: "MEN",
    category: "Men",
    image: "/categories/men.jpg",
  },
  {
    label: "KIDS",
    category: "Kids",
    image: "/categories/kids.jpg",
  },
  {
    label: "ELECTRONICS",
    category: "Electronics",
    image: "/categories/electronics.jpg",
  },
  {
    label: "HOME & LIVING",
    category: "Home & Living",
    image: "/categories/home-living.jpg",
  },
];

export default function CategoryTiles() {
  return (
    <div className="section">
      <h2 className="sectionTitle h2">Shop by Category</h2>
      <div className="underline" />
      <div className="tileGrid">
        {tiles.map((tile) => (
          <Link
            key={tile.category}
            className="tile focusRing"
            to={createPageUrl(`CategoryListing?category=${encodeURIComponent(tile.category)}`)}
            style={{ backgroundImage: `url(${tile.image})` }}
          >
            <span className="tileLabel">{tile.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
