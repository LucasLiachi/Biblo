export function Breadcrumb({ path }: { path: string }) {
  const parts = path.split("/");
  return (
    <nav className="breadcrumb" aria-label="Caminho no vault">
      <span className="breadcrumb-crumb">vault</span>
      {parts.map((part, i) => (
        <span key={`${i}-${part}`} style={{ display: "contents" }}>
          <span className="breadcrumb-separator" aria-hidden="true">/</span>
          <span className={`breadcrumb-crumb ${i === parts.length - 1 ? "current" : ""}`} aria-current={i === parts.length - 1 ? "page" : undefined}>
            {part}
          </span>
        </span>
      ))}
    </nav>
  );
}
