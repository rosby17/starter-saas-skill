import { serviceClient } from '@/lib/auth/service-client'
import { listProjects, listReviews, reviewStats, type StudentProject } from '@/lib/reviews/reviews'

const Stars = ({ n, size = 18 }: { n: number; size?: number }) => (
  <span aria-label={`${n} sur 5`} style={{ display: 'inline-flex', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} style={{ width: size, height: size, display: 'grid', placeItems: 'center', borderRadius: 3, background: i <= Math.round(n) ? 'var(--brand)' : 'var(--black-line)', color: '#fff', fontSize: size * 0.7, lineHeight: 1 }}>★</span>
    ))}
  </span>
)

/**
 * Avis VÉRIFIÉS d'une formation, publics, sans filtre (seuls les avis masqués par l'admin pour excès sont exclus).
 * Les chiffres sont donnés tels quels : élèves inscrits, avis donnés, taux, positifs, neutres, négatifs.
 */
export async function ReviewsSection({ productId }: { productId: string }) {
  const db = serviceClient()
  const [stats, reviews, projects] = await Promise.all([reviewStats(db, productId), listReviews(db, productId), listProjects(db, productId)])
  if (stats.enrolled === 0 && stats.reviews === 0 && projects.length === 0) return null
  const projectOf = new Map(projects.filter((p) => p.reviewId).map((p) => [p.reviewId!, p]))
  const card = { borderRadius: 20, border: '1px solid var(--black-line)', background: 'var(--black-card)', padding: 22 } as const
  return (
    <>
    {projects.length > 0 && (
      <section id="projets-eleves" style={{ marginTop: 56, scrollMarginTop: 90 }}>
        <p style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 10 }}>Résultats des élèves</p>
        <h2 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', color: 'var(--white)', marginBottom: 8 }}>Ils l’ont fait après la formation</h2>
        <p style={{ color: 'var(--white-muted)', marginBottom: 22, maxWidth: 640, lineHeight: 1.6 }}>De vraies pubs et animations réalisées par des élèves, avec les méthodes du cours. Pas des démos du formateur : leurs projets.</p>
        <div className="pj-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
          {projects.map((p) => <ProjectCard key={p.id} p={p} />)}
        </div>
      </section>
    )}
    <section id="avis" style={{ marginTop: 56, scrollMarginTop: 90 }}>
      <p style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 10 }}>Avis vérifiés</p>
      <h2 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', color: 'var(--white)', marginBottom: 20 }}>Ce qu’en disent les élèves</h2>
      <div className="rv-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--white)' }}>{stats.reviews ? stats.average.toFixed(1).replace('.', ',') : '—'}</span>
            <span style={{ color: 'var(--white-muted)' }}>/ 5</span>
          </div>
          {stats.reviews > 0 && <Stars n={stats.average} size={22} />}
          <p style={{ marginTop: 12, color: 'var(--white-muted)', fontSize: 14, lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--white)' }}>{stats.enrolled}</strong> élève{stats.enrolled > 1 ? 's' : ''} inscrit{stats.enrolled > 1 ? 's' : ''} ·{' '}
            <strong style={{ color: 'var(--white)' }}>{stats.reviews}</strong> avis ({stats.rate} % des élèves)
          </p>
          <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
            {stats.distribution.map((count, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 28px', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--white-muted)' }}>
                <span>{5 - i} ★</span>
                <span style={{ height: 8, borderRadius: 99, background: 'var(--black-line)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${stats.reviews ? (count / stats.reviews) * 100 : 0}%`, background: 'var(--brand)' }} /></span>
                <span style={{ textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ padding: '4px 10px', borderRadius: 99, background: 'var(--tone-green-bg)', color: 'var(--tone-green-text)' }}>{stats.positive} positif{stats.positive > 1 ? 's' : ''}</span>
            <span style={{ padding: '4px 10px', borderRadius: 99, background: 'var(--tone-amber-bg)', color: 'var(--tone-amber-text)' }}>{stats.neutral} neutre{stats.neutral > 1 ? 's' : ''}</span>
            <span style={{ padding: '4px 10px', borderRadius: 99, background: 'var(--tone-red-bg)', color: 'var(--tone-red-text)' }}>{stats.negative} négatif{stats.negative > 1 ? 's' : ''}</span>
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--white-dim)', lineHeight: 1.5 }}>
            Seuls les élèves qui ont acheté la formation et commencé le cours peuvent donner leur avis. Tous les avis sont publiés, positifs comme négatifs.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          {reviews.length === 0 && <p style={{ ...card, color: 'var(--white-muted)' }}>Pas encore d’avis : les premiers élèves sont en train de suivre la formation.</p>}
          {reviews.map((r) => (
            <article key={r.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {r.avatar
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={r.avatar} alt="" referrerPolicy="no-referrer" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  : <span style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--black-mid)', color: 'var(--white)', fontWeight: 700 }}>{r.author[0]}</span>}
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: 'var(--white)', fontWeight: 600 }}>{r.author}{r.city ? <span style={{ color: 'var(--white-dim)', fontWeight: 400 }}> · {r.city}</span> : null}</p>
                  <p style={{ fontSize: 12, color: 'var(--tone-green-text)' }}>✔ Achat vérifié · a suivi {r.progress} % de la formation</p>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--white-dim)' }}>{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div style={{ marginTop: 12 }}><Stars n={r.rating} /></div>
              {r.title && <p style={{ marginTop: 10, color: 'var(--white)', fontWeight: 600, fontSize: 16 }}>{r.title}</p>}
              <p style={{ marginTop: 6, color: 'var(--white-muted)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{r.body}</p>
              {projectOf.get(r.id) && <div style={{ marginTop: 14, maxWidth: 520 }}><ProjectVideo p={projectOf.get(r.id)!} /><p style={{ marginTop: 6, fontSize: 13, color: 'var(--white-dim)' }}>🎬 Son projet réalisé avec la formation{projectOf.get(r.id)!.title ? ` : ${projectOf.get(r.id)!.title}` : ''}</p></div>}
              {r.postId && (
                <a href={`/communaute?g=avis#msg-${r.postId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '8px 14px', borderRadius: 99, border: '1px solid var(--black-line)', color: 'var(--white)', fontSize: 14, textDecoration: 'none' }}>
                  💬 Discuter avec {r.author.split(' ')[0]} dans la communauté
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 860px) { .rv-grid { grid-template-columns: 1fr !important; } } @media (max-width: 400px) { .pj-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
    </>
  )
}

function ProjectVideo({ p }: { p: StudentProject }) {
  return (
    <video src={p.video} poster={p.poster ?? undefined} controls playsInline preload="none" controlsList="nodownload"
      style={{ display: 'block', width: '100%', aspectRatio: p.aspect, objectFit: 'contain', background: '#000', borderRadius: 14 }} />
  )
}

function ProjectCard({ p }: { p: StudentProject }) {
  return (
    <article style={{ borderRadius: 20, border: '1px solid var(--black-line)', background: 'var(--black-card)', padding: 12, display: 'flex', flexDirection: 'column' }}>
      <ProjectVideo p={p} />
      <div style={{ padding: '12px 6px 4px' }}>
        <p style={{ color: 'var(--white)', fontWeight: 600 }}>{p.title || 'Projet d’élève'}</p>
        <p style={{ fontSize: 13, color: 'var(--brand)', marginTop: 2 }}>par {p.author}</p>
        {p.description && <p style={{ fontSize: 14, color: 'var(--white-muted)', marginTop: 6, lineHeight: 1.5 }}>{p.description}</p>}
      </div>
    </article>
  )
}
