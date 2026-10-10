import Link from 'next/link'
import { activePromo, preorderDeposit, pricePeriod, productHref, type Product } from '@/lib/catalog/types'
import { Price } from '@/components/Price'

// Carte produit de la boutique (rendu serveur, style du site d'origine).
export default function ProductCard({ product }: { product: Product }) {
  const promo = activePromo(product)
  const external = !!product.external_url
  const href = external ? product.external_url! : productHref(product)
  const price = product.price_fcfa == null
    ? (external ? 'Voir le site' : 'Sur demande')
    : <><Price fcfa={promo?.priceFcfa ?? product.price_fcfa} />{pricePeriod(product)}</>
  const struck = promo ? product.price_fcfa : product.compare_at_fcfa
  const body = (
    <>
      <div className="pc-media">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt="" loading="lazy" />
        ) : (
          <span aria-hidden className="pc-initial">{product.title.slice(0, 1)}</span>
        )}
        {product.preorder ? <span className="pc-badge">Précommande</span> : promo && <span className="pc-badge">Promo</span>}
      </div>
      <div className="pc-body">
        <h3>{product.title}</h3>
        {product.subtitle && <p className="pc-sub">{product.subtitle}</p>}
        {product.preorder && product.price_fcfa != null && (
          <p className="pc-sub">Réserve ta place : <Price fcfa={preorderDeposit(promo?.priceFcfa ?? product.price_fcfa)} /> (10 %), puis 60 % à la sortie.</p>
        )}
        <p className="pc-price">
          <span>{price}</span>
          {struck != null && product.price_fcfa != null && struck > (promo?.priceFcfa ?? product.price_fcfa) && <s><Price fcfa={struck} /></s>}
          <span aria-hidden className="pc-arrow">{external ? '↗' : '→'}</span>
        </p>
      </div>
    </>
  )
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="pc">{body}</a>
  ) : (
    <Link href={href} className="pc">{body}</Link>
  )
}

export const productCardCss = `
.pc { display: flex; flex-direction: column; border: 1px solid var(--black-line); border-radius: 22px; background: var(--black-card); overflow: hidden; text-decoration: none; color: var(--white); transition: border-color .2s, transform .2s; }
.pc:hover { border-color: var(--brand); transform: translateY(-2px); }
.pc-media { position: relative; aspect-ratio: 16 / 9; background: var(--black-mid); display: grid; place-items: center; overflow: hidden; }
.pc-media img { width: 100%; height: 100%; object-fit: cover; }
.pc-initial { font-size: 64px; font-weight: 500; color: var(--brand); letter-spacing: -0.05em; }
.pc-badge { position: absolute; top: 12px; left: 12px; padding: 5px 12px; border-radius: 999px; background: var(--brand); color: #fff; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.pc-body { display: flex; flex-direction: column; gap: 8px; padding: 20px 20px 18px; flex: 1; }
.pc-body h3 { font-size: 20px; font-weight: 500; line-height: 1.2; }
.pc-sub { font-size: 14px; color: var(--white-muted); line-height: 1.55; }
.pc-price { margin-top: auto; padding-top: 10px; display: flex; align-items: baseline; gap: 10px; font-weight: 600; }
.pc-price s { color: var(--white-dim); font-weight: 500; font-size: 14px; text-decoration-color: var(--brand); }
.pc-arrow { margin-left: auto; color: var(--brand); font-size: 20px; }
`
