import { useState } from "react";
import { Link } from "react-router-dom";
import { createProductUrl } from "../lib/pages";
import { formatPrice, getColorImage, getInitialColor, getSwatchColor } from "../lib/productUi";

export default function ProductCard({
  product,
  isTrending,
  onQuickView,
  onWishlist,
  wishlistLabel = "Wishlist",
}) {
  const [selectedColor, setSelectedColor] = useState(() => getInitialColor(product));
  const primaryImage = getColorImage(product, selectedColor);

  return (
    <div className="pCard">
      <div className="pMedia">
        <img
          className="pImg"
          src={primaryImage}
          alt={product.title}
          loading="lazy"
          decoding="async"
          width="560"
          height="420"
        />
        <div className="pBadges">
          {isTrending ? <span className="badge badgeTrending">Trending</span> : null}
        </div>
      </div>
      <div className="pMeta">
        <div className="pBrand">{(product.brand || "Q").toUpperCase()}</div>
        <Link to={createProductUrl(product.id)} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="pName">{product.title}</div>
        </Link>
        <div className="pPrice">{formatPrice(product)}</div>
        <div className="pRating">
          ★ {Number(product.rating_avg || 0).toFixed(1)} ({Number(product.rating_count || 0)})
        </div>
        {product.colors?.length ? (
          <div className="pSwatches">
            {product.colors.map((color) => (
              <button
                key={color}
                className="swatch sw"
                type="button"
                aria-label={`Colour: ${color}`}
                style={{ backgroundColor: getSwatchColor(color) }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
        ) : null}
        <div className="pActs">
          <button className="btnPrimary" type="button" onClick={() => onQuickView?.(product, selectedColor)}>
            Quick add
          </button>
          <button
            className="btnGhost"
            type="button"
            onClick={() => onQuickView?.(product, selectedColor)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onQuickView?.(product, selectedColor);
              }
            }}
          >
            Quick view
          </button>
          {onWishlist ? (
            <button className="btnGhost" type="button" onClick={() => onWishlist(product)}>
              {wishlistLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
