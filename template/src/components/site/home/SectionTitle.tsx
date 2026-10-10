// En-tête de section façon éditorial : petit label numéroté + grand titre.
export default function SectionTitle({
  index,
  label,
  children,
  aside,
}: {
  index: string;
  label: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
        marginBottom: 40,
        paddingTop: 20,
        borderTop: "1px solid var(--black-line)",
      }}
    >
      <div>
        <p style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--white-muted)", marginBottom: 18 }}>
          <span style={{ color: "var(--brand)" }}>{index}</span> — {label}
        </p>
        <h2
          style={{
            fontSize: "clamp(36px, 5.2vw, 72px)",
            fontWeight: 500,
            letterSpacing: "-0.045em",
            lineHeight: 1,
            color: "var(--white)",
          }}
        >
          {children}
        </h2>
      </div>
      {aside}
    </div>
  );
}
