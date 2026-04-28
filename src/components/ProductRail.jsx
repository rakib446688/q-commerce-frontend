import { useRef } from "react";
import { Link } from "react-router-dom";
import ProductCard from "./ProductCard";

export default function ProductRail({
  kicker,
  title,
  viewAllTo,
  products = [],
  onQuickView,
  onWishlist,
}) {
  const trackRef = useRef(null);
  const hasItems = products.length > 0;

  function scrollByAmount(amount) {
    if (!trackRef.current) return;
    trackRef.current.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <section className="rail">
      <div className="railTop">
        <div>
          <div className="kicker">{kicker}</div>
          <h2 className="h2">{title}</h2>
        </div>
        <Link className="btnGhost focus" to={viewAllTo}>
          View All →
        </Link>
      </div>
      {products.length > 1 ? (
        <div className="railControls">
          <button
            className="iconBtn focus"
            type="button"
            onClick={() => scrollByAmount(-320)}
            aria-label="Scroll left"
          >
            ←
          </button>
          <button
            className="iconBtn focus"
            type="button"
            onClick={() => scrollByAmount(320)}
            aria-label="Scroll right"
          >
            →
          </button>
        </div>
      ) : null}
      {hasItems ? (
        <div className="railTrack" ref={trackRef}>
          {products.map((product) => (
            <div key={product.id} className="railCard">
              <ProductCard
                product={product}
                isTrending={false}
                onQuickView={onQuickView}
                onWishlist={onWishlist}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="railEmpty card">
          <p className="p">No items to show yet.</p>
        </div>
      )}
    </section>
  );
}

