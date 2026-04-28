import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="siteFooter">
      <div className="footerInner container">
        <div>
          <div className="footerBrand">
            <img
              className="footerLogoImg"
              src="/logo.jpg"
              alt="Q-Commerce"
              width="44"
              height="44"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
        <div>
          <h4 className="footerTitle">Shop</h4>
          <Link className="footerLink" to="/shop">All Products</Link>
          <Link className="footerLink" to="/trending">Trending</Link>
          <Link className="footerLink" to="/category?category=Women">Women</Link>
          <Link className="footerLink" to="/category?category=Men">Men</Link>
        </div>
        <div>
          <h4 className="footerTitle">Account</h4>
          <Link className="footerLink" to="/account">Account</Link>
          <Link className="footerLink" to="/wishlist">Wishlist</Link>
          <Link className="footerLink" to="/cart">Cart</Link>
        </div>
        <div>
          <h4 className="footerTitle">Support</h4>
          <span className="footerLink">Help Center</span>
          <span className="footerLink">Returns</span>
          <span className="footerLink">Contact</span>
        </div>
      </div>
      <div className="footerBottom">Website Designed by MD Rakib Hasan</div>
    </footer>
  );
}
